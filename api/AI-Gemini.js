import express from "express";
import axios from "axios";

const router = express.Router();

class GeminiAPI {
  constructor() {
    this.baseUrl =
      "https://us-central1-infinite-chain-295909.cloudfunctions.net/gemini-proxy-staging-v1";
    this.headers = {
      accept: "*/*",
      "accept-language": "id-ID,id;q=0.9",
      "content-type": "application/json",
      priority: "u=1, i",
      "sec-ch-ua":
        '"Chromium";v="131", "Not_A Brand";v="24", "Microsoft Edge Simulate";v="131", "Lemur";v="131"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "cross-site",
      "user-agent":
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    };
  }

  async getData(imageUrl) {
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    return {
      inline_data: {
        mime_type: response.headers["content-type"],
        data: Buffer.from(response.data, "binary").toString("base64"),
      },
    };
  }

  async chat({ model = "gemini-2.0-flash-lite", prompt, imageUrl = null, ...rest }) {
    if (!prompt) throw new Error("Prompt is required");

    const parts = [];

    if (imageUrl) {
      const urls = Array.isArray(imageUrl) ? imageUrl : [imageUrl];
      for (const url of urls) {
        const imagePart = await this.getData(url);
        parts.push(imagePart);
      }
    }

    parts.push({ text: prompt });

    const body = { contents: [{ parts }], ...rest };

    const response = await axios.post(this.baseUrl, body, { headers: this.headers });
    return response.data;
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { prompt, imageUrl } = req.body;
    if (!prompt) return res.status(400).json({ status: false, message: "⚠️ النص مطلوب (prompt)" });

    const gemini = new GeminiAPI();
    const result = await gemini.chat({ prompt, imageUrl });

    const output = result?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    if (!output)
      return res.status(500).json({ status: false, message: "⚠️ لم يتم الحصول على استجابة من Gemini" });

    res.json({ status: true, message: "✅ تم الحصول على الرد بنجاح", response: output });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "❌ حدث خطأ أثناء التواصل مع Gemini API", error: err.message });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const prompt = req.query.prompt;
    let imageUrl = req.query.imageUrl;

    if (!prompt) return res.status(400).json({ status: false, message: "⚠️ النص مطلوب (prompt)" });

    if (imageUrl && typeof imageUrl === "string") {
      imageUrl = imageUrl.split(","); // لو أرسل أكثر من رابط مفصول بفاصلة
    }

    const gemini = new GeminiAPI();
    const result = await gemini.chat({ prompt, imageUrl });

    const output = result?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    if (!output)
      return res.status(500).json({ status: false, message: "⚠️ لم يتم الحصول على استجابة من Gemini" });

    res.json({ status: true, message: "✅ تم الحصول على الرد بنجاح", response: output });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "❌ حدث خطأ أثناء التواصل مع Gemini API", error: err.message });
  }
});

export default router;