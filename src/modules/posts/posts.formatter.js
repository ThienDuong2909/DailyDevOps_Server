const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../config');
const { BadRequestError } = require('../../middlewares/error.middleware');

const formatContentByGemini = async (content) => {
    if (!config.gemini?.apiKey) {
        throw new BadRequestError('Gemini API key is not configured.');
    }

    // Choose the generative model
    const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Fast and efficient for text tasks

    const prompt = `
Bạn là một trợ lý SEO biên tập. Hãy nhận bài viết dưới đây và chuẩn hóa cấu trúc bài viết theo trình tự chuẩn SEO:
1. Mở đầu bằng phần Đặt vấn đề.
2. Đi vào nội dung chính, bắt buộc cấu trúc: Sử dụng số La Mã (I, II, III...) cho các tiêu đề phần lớn, và số đếm (1, 2, 3...) cho các mục con.
3. Đối với các bước yêu cầu chạy lệnh (ví dụ như lệnh terminal/bash/script), bạn CẦN TRÌNH BÀY theo thứ tự: giải thích những thứ cần làm trước đó, sau đó hiển thị lệnh, và cuối cùng phần dưới cụm lệnh CẦN GIẢI THÍCH các thành phần của lệnh đó có tác dụng gì.
4. Cuối bài viết, hãy luôn thêm một phần tổng kết/tóm tắt lại thành tựu đạt được qua bài viết này.

NHỮNG QUY TẮC CẤM KỴ: 
- BẠN CÓ THỂ TỰ ĐỘNG CĂN CHỈNH, TỰ THÊM NỘI DUNG VÀ VIẾT LẠI cho hay hơn, đúng cấu trúc.
- KHÔNG thay đổi url, KHÔNG xóa, KHÔNG chỉnh sửa bất kỳ đường link hình ảnh nào (thẻ markdown image ![...](...) hay thẻ <img>). (Bạn được phép di chuyển vị trí của chúng cho hợp lý với nội dung).
- KHÔNG tự tiện thay đổi nội dung code (trong \` \` hoặc \`\`\` \`\`\`). (Bạn được phép di chuyển khối code theo quy trình hợp lý, nhưng không đổi nội dung code).

Lưu ý quan trọng: Chỉ trả về nguyên văn nội dung sau khi đã chuẩn hóa thành markdown, KHÔNG wrap trong thẻ \`\`\`markdown, không kèm thêm lời chào hỏi hay giải thích gì khác.

Nội dung bài viết ban đầu:
---
${content}
---
`;

    let attempt = 0;
    const maxRetries = 3;

    while (attempt < maxRetries) {
        try {
            const result = await model.generateContent(prompt);
            let finalContent = result.response.text() || '';

            // Remove wrap code around markdown if AI returned it
            if (finalContent.startsWith('```markdown')) {
                finalContent = finalContent.replace(/^```markdown\n?/, '');
                finalContent = finalContent.replace(/\n?```$/, '');
            }

            return finalContent;
        } catch (error) {
            attempt++;
            const isOverloaded = error.status === 503 || error.message?.includes('503') || error.status === 429 || error.message?.includes('429') || error.message?.includes('high demand');
            
            if (isOverloaded && attempt < maxRetries) {
                console.warn(`Gemini API overloaded (503/429). Retrying attempt ${attempt}...`);
                // Exponential backoff
                await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            } else {
                console.error('Gemini format error:', error);
                throw new BadRequestError(
                    isOverloaded 
                        ? 'Hệ thống AI đang quá tải cục bộ. Vui lòng thử lại sau ít phút.' 
                        : 'Failed to format content via Gemini API. ' + error.message
                );
            }
        }
    }
};

module.exports = { formatContentByGemini };
