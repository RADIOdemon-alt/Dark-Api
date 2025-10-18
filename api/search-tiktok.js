import express from "express";
import axios from "axios";
import FormData from "form-data";

const router = express.Router();

// 🔎 البحث عن فيديوهات TikTok عبر tikwm.com
const ttSearch = async (query, count = 10) => {
  try {
    let form = new FormData();
    form.append("keywords", query);
    form.append("count", count);
    form.append("cursor", 0);
    form.append("web", 1);
    form.append("hd", 1);

    const headers = { headers: { ...form.getHeaders() } };
    const { data } = await axios.post("https://tikwm.com/api/feed/search", form, headers);

    if (!data?.data?.videos) return [];

    const baseURL = "https://tikwm.com";
    return data.data.videos.map(video => ({
      title: video.title || "بدون عنوان",
      play: baseURL + video.play,
      cover: baseURL + video.cover
    }));
  } catch (e) {
    console.error("❌ خطأ أثناء جلب فيديوهات TikTok:", e.message);
    return [];
  }
};

// ⚙️ GET + POST endpoint
router.all("/", async (req, res) => {
  const query = req.query.text || req.body.text;

  if (!query) {
    return res.status(400).json({
      status: false,
      message: "📌 أرسل نص البحث عن الفيديوهات:\n/api/tiktok-search?text=cat funny",
    });
  }

  try {
    const results = await ttSearch(query, 10);

    if (!results.length) {
      return res.status(404).json({
        status: false,
        message: `❌ لم يتم العثور على نتائج لـ "${query}"`,
      });
    }

    res.json({
      status: true,
      query,
      totalResults: results.length,
      videos: results,
      message: "✅ تم العثور على الفيديوهات بنجاح"
    });
  } catch (err) {
    console.error("❌ خطأ:", err.message);
    res.status(500).json({
      status: false,
      message: "⚠️ حدث خطأ أثناء البحث، أعد المحاولة لاحقًا.",
    });
  }
});

export default router;