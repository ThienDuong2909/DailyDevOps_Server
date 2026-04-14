const config = require('../../config');
const { BadRequestError } = require('../../middlewares/error.middleware');

const executeFormattingRequest = async (model, prompt, apiKey) => {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": config.appUrl || "https://dailydevops.blog",
            "X-Title": "Devops Blog Formatter"
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: "user", content: prompt }]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter lỗi HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const finalContent = data?.choices?.[0]?.message?.content;

    if (!finalContent) {
        console.error(`[OpenRouter Debug] Data Dump:`, JSON.stringify(data));
        throw new Error("Không có dữ liệu trả về từ OpenRouter. Format bị từ chối hoặc hết tài nguyên.");
    }

    return finalContent;
};

const cleanMarkdownContent = (content) => {
    let cleanContent = content;
    // Remove wrap code around markdown if AI returned it
    if (cleanContent.startsWith('```markdown')) {
        cleanContent = cleanContent.replace(/^```markdown\n?/, '');
        cleanContent = cleanContent.replace(/\n?```$/, '');
    }
    return cleanContent;
};

/**
 * Format markdown content into SEO friendly structure using OpenRouter API
 * @param {string} rawContent 
 * @returns {Promise<string>}
 */
const formatContentByGemini = async (rawContent) => {
    if (!rawContent || typeof rawContent !== 'string') {
        throw new BadRequestError('Content must be provided as a string.');
    }

    const apiKey = config.openrouter.apiKey;
    if (!apiKey) {
        throw new BadRequestError('OpenRouter API key is not configured.');
    }
    
    const fallbackModels = [
        "meta-llama/llama-3.3-70b-instruct:free",
        "google/gemma-3-27b-it:free",
        "nousresearch/hermes-3-llama-3.1-405b:free",
        "nvidia/nemotron-3-super-120b-a12b:free"
    ];

    const prompt = `
Bạn là một trợ lý SEO biên tập. Hãy nhận bài viết dưới đây và chuẩn hóa cấu trúc bài viết theo trình tự chuẩn SEO:
1. Đặt vấn đề (Giới thiệu ngắn gọn).
2. Vào nội dung chính (Đánh số La Mã I, II, III... cho các phần lớn trọng tâm).
3. Các phần con đánh 1, 2, 3...
4. Đối với các bước chạy lệnh (ví dụ \`sudo apt update\`), cần giải thích những thứ cần làm trước, sau đó tới câu lệnh và dưới là giải thích giải phẫu thành phần lệnh.
5. Sau phần nội dung chính, tóm tắt lại bài viết.

Lưu ý:
- CHỈ TRẢ VỀ nội dung bài viết đã định dạng bằng Markdown. KHÔNG trả lời thêm bất kỳ câu giao tiếp nào (như "Dưới đây là...", "Vâng...").
- KHÔNG thay đổi văn phong hoặc cắt bỏ nội dung chính của tôi, chỉ viết lại và phân chia bố cục tự động.
- KHÔNG chỉnh sửa hình ảnh (nhưng có thể sắp xếp lại vị trí cho hợp lý).
- KHÔNG sửa nội dung đoạn mã trong thẻ \`code\`.

Bài viết cần chuẩn hóa:
---
${rawContent}
---
`;

    let attempt = 0;
    const maxRetries = fallbackModels.length;

    while (attempt < maxRetries) {
        const currentModel = fallbackModels[attempt];
        
        try {
            const rawOutput = await executeFormattingRequest(currentModel, prompt, apiKey);
            return cleanMarkdownContent(rawOutput);
        } catch (error) {
            attempt++;
            
            const isOverloaded = error.message?.includes('429') || error.message?.includes('503') || error.message?.includes('rate-limited') || error.message?.includes('temporarily');
            
            if (isOverloaded && attempt < maxRetries) {
                console.warn(`[OpenRouter] Model ${currentModel} overloaded. Falling back to next model...`);
                await new Promise((resolve) => setTimeout(resolve, 1000));
            } else {
                console.error(`[OpenRouter] format error on ${currentModel}:`, error);
                const errMessage = isOverloaded 
                    ? 'Tất cả các model AI miễn phí đều đang quá tải hoặc hết lượt (Rate Limited). Vui lòng thử lại sau vài phút.' 
                    : `Failed to format content via AI. ${error.message}`;
                    
                throw new BadRequestError(errMessage);
            }
        }
    }
};

module.exports = {
    formatContentByGemini
};
