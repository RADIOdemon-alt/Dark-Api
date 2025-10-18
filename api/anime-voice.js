import express from "express";
import axios from "axios";

const router = express.Router();

const models = {
  "غوكو": { voice_id: "67aed50c-5d4b-11ee-a861-00163e2ac61b", voice_name: "غوكو" },
  "رابر": { voice_id: "c82964b9-d093-11ee-bfb7-e86f38d7ec1a", voice_name: "رابر" },
  "نامي": { voice_id: "67ad95a0-5d4b-11ee-a861-00163e2ac61b", voice_name: "نامي" },
  "يوكي": { voice_id: "67ae0979-5d4b-11ee-a861-00163e2ac61b", voice_name: "يوكي" },
};

// دالة لتوليد IP عشوائي
function getRandomIp() {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join(".");
}

// مجموعة user agents عشوائية
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6)",
  "Mozilla/5.0 (Linux; Android 8.0.0; Pixel 2 XL)"
];

// الدالة الرئيسية لإنشاء الصوت
async function generateTTS(text, voiceId) {
  const agent = userAgents[Math.floor(Math.random() * userAgents.length)];
  const payload = {
    raw_text: text,
    url: "https://filme.imyfone.com/text-to-speech/anime-text-to-speech/",
    product_id: "200054",
    convert_data: [
      { voice_id: voiceId, speed: "1", volume: "50", text, pos: 0 }
    ]
  };

  const config = {
    headers: {
      "Content-Type": "application/json",
      "Accept": "*/*",
      "X-Forwarded-For": getRandomIp(),
      "User-Agent": agent,
    },
    timeout: 30000,
  };

  const res = await axios.post(
    "https://voxbox-tts-api.imyfone.com/pc/v1/voice/tts",
    payload,
    config
  );

  const result = res.data?.data?.convert_result?.[0];
  if (!result || !result.oss_url)
    throw new Error("لم يتم استرجاع رابط الصوت من الخادم");

  return result.oss_url;
}

// المسار الرئيسي
router.all("/", async (req, res) => {
  try {
    const prompt = req.method === "GET" ? req.query.prompt : req.body.prompt;
    const voice = req.method === "GET" ? req.query.voice : req.body.voice;

    if (!prompt || !voice)
      return res
        .status(400)
        .json({ status: false, message: "❌ يرجى إدخال prompt و voice" });

    const voiceData = models[voice];
    if (!voiceData)
      return res
        .status(400)
        .json({ status: false, message: "❌ الصوت غير موجود في القائمة" });

    const oss_url = await generateTTS(prompt, voiceData.voice_id);

    res.json({
      status: true,
      voice: voiceData.voice_name,
      url: oss_url,
    });
  } catch (err) {
    res
      .status(500)
      .json({ status: false, message: `❌ حدث خطأ: ${err.message}` });
  }
});

// عرض قائمة الأصوات
router.get("/voices", (req, res) => {
  const list = Object.entries(models).map(([name, info]) => ({
    name,
    voice_id: info.voice_id,
  }));
  res.json({ status: true, voices: list });
});

export default router;