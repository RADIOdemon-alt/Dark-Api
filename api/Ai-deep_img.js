import express from "express";
import axios from "axios";

const router = express.Router();

/* قائمة الموديلات */
const modelsMap = {
  "img": "realistic",
  "realistic": "realistic",
  "fantasy": "fantasy",
  "cyberpunk": "cyberpunk",
  "anime": "anime",
  "cartoon": "cartoon",
  "cinematic": "cinematic",
  "artistic": "artistic",
  "vintage": "vintage",
  "portrait": "portrait",
  "surreal": "surreal",
  "sketch": "sketch",
  "watercolor": "watercolor",
  "pixel": "pixel art"
};

/* دالة الترجمة */
const translateText = async (text) => {
  try {
    const res = await axios.get(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ar|en`
    );
    return res.data.responseData.translatedText;
  } catch {
    return text;
  }
};

/* دالة توليد الصورة */
async function generateImage(prompt, modelStyle) {
  // ترجمة إذا النص عربي
  if (/[\u0600-\u06FF]/.test(prompt)) {
    prompt = await translateText(prompt);
  }

  const deviceId = `dev-${Math.floor(Math.random() * 1000000)}`;

  const response = await axios.post(
    "https://api-preview.chatgot.io/api/v1/deepimg/flux-1-dev",
    {
      prompt: `${prompt} -style ${modelStyle}`,
      size: "1024x1024",
      device_id: deviceId
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://deepimg.ai",
        "Referer": "https://deepimg.ai/"
      }
    }
  );

  const data = response.data;
  if (data?.data?.images?.length > 0) {
    return data.data.images[0].url;
  } else {
    throw new Error("فشل في توليد الصورة.");
  }
}

/* GET */
router.get("/", async (req, res) => {
  try {
    let { prompt, model = "img" } = req.query;
    if (!prompt)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ النص المطلوب (prompt) مفقود" });

    const style = modelsMap[model.toLowerCase()] || "realistic";
    const imageUrl = await generateImage(prompt, style);

    res.json({
      status: true,
      message: "✅ تم توليد الصورة بنجاح",
      model,
      style,
      prompt,
      imageUrl
    });
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
    res
      .status(500)
      .json({
        status: false,
        message: "❌ حدث خطأ أثناء توليد الصورة",
        error: err.message
      });
  }
});

/* POST */
router.post("/", async (req, res) => {
  try {
    let { prompt, model = "img" } = req.body;
    if (!prompt)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ النص المطلوب (prompt) مفقود" });

    const style = modelsMap[model.toLowerCase()] || "realistic";
    const imageUrl = await generateImage(prompt, style);

    res.json({
      status: true,
      message: "✅ تم توليد الصورة بنجاح",
      model,
      style,
      prompt,
      imageUrl
    });
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
    res
      .status(500)
      .json({
        status: false,
        message: "❌ حدث خطأ أثناء توليد الصورة",
        error: err.message
      });
  }
});

export default router;