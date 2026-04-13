const config = require('../../config');
const { BadRequestError } = require('../../middlewares/error.middleware');

/**
 * Format markdown content into SEO friendly structure using OpenRouter API
 * @param {string} rawContent 
 * @returns {Promise<string>}
 */
const formatContentByGemini = async (rawContent) => {
    if (!rawContent || typeof rawContent !== 'string') {
        throw new BadRequestError('Content must be provided as a string.');
    }

    // Using the OpenRouter key and model provided by the user
    // In production, this should be moved to .env
    const apiKey = "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";
    const modelOptions = ["google/gemma-4-26b-a4b-it:free", "google/gemma-2-9b-it:free", "google/gemini-pro-1.5"]; // Added some fallback models just in case the provided one has typo
    const defaultModel = "google/gemma-4-26b-a4b-it:free";

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

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": config.appUrl || "https://dailydevops.blog",
                "X-Title": "Devops Blog Formatter"
            },
            body: JSON.stringify({
                model: defaultModel,
                messages: [
                    { role: "user", content: prompt }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter lỗi HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        
        let finalContent = data.choices && data.choices[0] && data.choices[0].message.content;

        if (!finalContent) {
             throw new Error("Không có dữ liệu trả về từ OpenRouter.");
        }

        // Remove wrap code around markdown if AI returned it
        if (finalContent.startsWith('```markdown')) {
            finalContent = finalContent.replace(/^```markdown\n?/, '');
            finalContent = finalContent.replace(/\n?```$/, '');
        }

        return finalContent;
    } catch (error) {
        console.error('OpenRouter format error:', error);
        throw new BadRequestError('Failed to format content via AI. ' + error.message);
    }
};

module.exports = {
    formatContentByGemini
};
