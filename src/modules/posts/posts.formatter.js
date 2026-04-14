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
        throw new Error("PROVIDER_FAILED: Không có dữ liệu trả về từ AI. Bài viết có thể quá dài hoặc chứa nội dung nhạy cảm bị từ chối.");
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
    
    // Ưu tiên Llama 3.3 vì nó rất nhanh và xuất sắc
    const fallbackModels = [
        "meta-llama/llama-3.3-70b-instruct:free",
        "google/gemma-3-12b-it:free",
        "google/gemma-3-4b-it:free"
    ];

    const basePrompt = `Bạn là một trợ lý SEO biên tập. Nhiệm vụ của bạn là định dạng lại nội dung, giữ nguyên TẤT CẢ các lời văn và khối lệnh, cấu trúc lại thành Markdown chuyên nghiệp.

1. Bắt đầu bằng thẻ Heading (<h1> hoặc <h2> tùy nội dung) với Tiêu đề thân thiện.
2. Vào nội dung chính. Hãy đánh số La Mã I, II, III... cho các mục lục / chủ đề lớn.
3. Các phần con bên trong đánh 1, 2, 3...
4. Trong các khối lệnh (như npm install, apt update...), giải thích chức năng trước khi trình bày khối lệnh.
5. Sau phần nội dung cuối cùng, tóm tắt lại nhanh (nếu đây là phần kết của bài viết).

Lưu ý QUAN TRỌNG:
- CHỈ TRẢ VỀ nội dung bài viết đã định dạng bằng Markdown. KHÔNG trả lời thêm bất kỳ câu giao tiếp nào (như "Dưới đây là...").
- KHÔNG thay đổi văn phong hoặc cắt xén câu chữ của tôi. TẤT CẢ phải được bảo toàn.
- KHÔNG làm hỏng đường link hình ảnh.
- KHÔNG sửa nội dung đoạn mã code.`;

    // Hàm chia nhỏ html an toàn theo h1, h2, h3 để tránh đứt đoạn
    const chunkHTML = (html, maxChars) => {
        const parts = html.split(/(?=<h[1-3]>)/i);
        const chunks = [];
        let temp = "";
        
        for (const part of parts) {
            if (temp.length + part.length > maxChars && temp.length > 0) {
                chunks.push(temp.trim());
                temp = part;
            } else {
                temp += part;
            }
        }
        if (temp.trim().length > 0) chunks.push(temp.trim());
        return chunks.length > 0 ? chunks : [html];
    };

    const processFailsafe = async (textChunk, dynamicPrompt, chunkIndex, totalChunks) => {
        let attempt = 0;
        const maxRetries = fallbackModels.length;

        while (attempt < maxRetries) {
            const currentModel = fallbackModels[attempt];
            try {
                console.log(`[OpenRouter] Processing Chunk ${chunkIndex + 1}/${totalChunks} with model: ${currentModel} (Length: ${textChunk.length} chars)`);
                const rawOutput = await executeFormattingRequest(currentModel, dynamicPrompt, apiKey);
                return cleanMarkdownContent(rawOutput);
            } catch (error) {
                attempt++;
                const isOverloaded = error.message?.includes('429') || error.message?.includes('503') || error.message?.includes('524') || error.message?.includes('rate-limited') || error.message?.includes('temporarily') || error.message?.includes('PROVIDER_FAILED');
                
                if (isOverloaded && attempt < maxRetries) {
                    console.warn(`[OpenRouter] Model ${currentModel} overloaded on Chunk ${chunkIndex + 1}. Falling back to next model...`);
                    await new Promise(r => setTimeout(r, 2000));
                } else {
                    console.error(`[OpenRouter] format error on ${currentModel} at chunk ${chunkIndex + 1}:`, error);
                    const errMessage = isOverloaded 
                        ? 'Tất cả các model AI miễn phí đều đang quá tải hoặc hết lượt (Rate Limited). Vui lòng thử lại sau vài phút.' 
                        : `Lỗi trong quá trình chuẩn hóa: ${error.message}`;
                    throw new BadRequestError(errMessage);
                }
            }
        }
    };

    const maxChunkSize = 3500; 
    
    if (rawContent.length <= maxChunkSize) {
        const singlePrompt = `${basePrompt}\n\nBài viết cần chuẩn hóa:\n---\n${rawContent}\n---`;
        return processFailsafe(rawContent, singlePrompt, 0, 1);
    } 
    
    console.log(`[OpenRouter] Content is large (${rawContent.length} chars). Splitting into chunks...`);
    const chunks = chunkHTML(rawContent, maxChunkSize);
    let finalFormattedText = "";
    
    for (let i = 0; i < chunks.length; i++) {
        let chunkPrompt = "";
        if (i === 0) {
            chunkPrompt = `${basePrompt}\n\nĐÂY LÀ PHẦN ${i + 1}/${chunks.length} CỦA BÀI VIẾT:\n---\n${chunks[i]}\n---`;
        } else if (i === chunks.length - 1) {
            chunkPrompt = `${basePrompt}\n\nLƯU Ý ĐẶC BIỆT: Đây là PHẦN CUỐI CÙNG (${i + 1}/${chunks.length}) của một bài viết đang được xử lý tiếp nối. BẠN PHẢI TIẾP TỤC định dạng dựa theo mạch bài. Nếu đang liệt kê số La Mã lớn, hãy chủ động tiếp tục logic đó. Ở cuối phần này, BẠN CÓ THỂ thêm tóm tắt.\n\nĐÂY LÀ PHẦN ${i + 1}:\n---\n${chunks[i]}\n---`;
        } else {
            chunkPrompt = `${basePrompt}\n\nLƯU Ý ĐẶC BIỆT: Đây là PHẦN ${i + 1}/${chunks.length} của một bài viết dài. BẠN PHẢI TIẾP TỤC định dạng dựa theo mạch bài. Nếu đang chuẩn hóa danh sách La Mã, hãy tiếp tục nối tiếp thứ tự. KHÔNG BAO GIỜ tự thêm Tóm tắt hay kết luận (vì bài chưa hết).\n\nĐÂY LÀ PHẦN ${i + 1}:\n---\n${chunks[i]}\n---`;
        }

        const chunkResult = await processFailsafe(chunks[i], chunkPrompt, i, chunks.length);
        finalFormattedText += chunkResult + "\n\n";
    }

    return finalFormattedText.trim();
};

module.exports = {
    formatContentByGemini
};
