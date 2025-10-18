import express from "express";
import axios from "axios";
import cheerio from "cheerio";

const router = express.Router();

// ⚡ البحث عن أغاني في Apple Music
router.all("/", async (req, res) => {
  const text = req.query.text || req.body.text;

  if (!text) {
    return res.status(400).json({
      status: false,
      message: "📌 أرسل نص البحث عن الأغنية:\n/api/applemusic?text=Joji - Glimpse of Us",
    });
  }

  try {
    const resData = await axios.get(`https://music.apple.com/us/search?term=${encodeURIComponent(text)}`);
    const $ = cheerio.load(resData.data);

    let firstItem = $('.grid-item').first();
    const title = firstItem.find('.top-search-lockup__primary__title').text().trim();
    const artist = firstItem.find('.top-search-lockup__secondary').text().trim();
    const link = firstItem.find('.click-action').attr('href');

    if (!title || !link) {
      return res.status(404).json({ status: false, message: "❌ لم يتم العثور على نتيجة مناسبة." });
    }

    res.json({
      status: true,
      title,
      artist,
      link,
      staticImage: "https://files.catbox.moe/hlsava.jpg",
      message: "✅ تم العثور على الأغنية بنجاح"
    });
  } catch (err) {
    console.error("❌ خطأ:", err.message);
    res.status(500).json({
      status: false,
      message: "⚠️ حدث خطأ أثناء البحث، تأكد من اتصالك أو أعد المحاولة.",
    });
  }
});

export default router;
