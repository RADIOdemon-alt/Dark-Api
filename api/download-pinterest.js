import express from 'express';
import axios from 'axios';

const router = express.Router();

const base = "https://www.pinterest.com";
const searchEndpoint = "/resource/BaseSearchResource/get/";

const headers = {
  'accept': 'application/json, text/javascript, */*, q=0.01',
  'referer': 'https://www.pinterest.com/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  'x-app-version': 'a9522f',
  'x-pinterest-appstate': 'active',
  'x-pinterest-pws-handler': 'www/[username]/[slug].js',
  'x-requested-with': 'XMLHttpRequest'
};

async function getCookies() {
  try {
    const response = await axios.get(base);
    const setHeaders = response.headers['set-cookie'];
    if (setHeaders) return setHeaders.map(c => c.split(';')[0].trim()).join('; ');
    return null;
  } catch {
    return null;
  }
}

async function searchPinterest(query) {
  if (!query) return { status: false, message: "⚠️ يرجى كتابة كلمة للبحث!" };
  const cookies = await getCookies();
  if (!cookies) return { status: false, message: "⚠️ فشل في الحصول على الكوكيز." };

  const params = {
    source_url: `/search/pins/?q=${query}`,
    data: JSON.stringify({
      options: { isPrefetch: false, query, scope: "pins", bookmarks: [""], page_size: 10 },
      context: {}
    }),
    _: Date.now()
  };

  try {
    const { data } = await axios.get(`${base}${searchEndpoint}`, {
      headers: { ...headers, cookie: cookies },
      params
    });

    const results = data?.resource_response?.data?.results?.filter(v => v.images?.orig) || [];

    if (!results.length)
      return { status: false, message: `❌ لم يتم العثور على نتائج لكلمة: *${query}*` };

    return {
      status: true,
      creator: "Anas radio",
      pins: results.map(r => ({
        id: r.id,
        title: r.title || "— بدون عنوان —",
        description: r.description || "— لا يوجد وصف —",
        pin_url: `https://pinterest.com/pin/${r.id}`,
        image: r.images.orig.url,
        uploader: {
          username: r.pinner?.username || "unknown",
          full_name: r.pinner?.full_name || "غير معروف",
          profile_url: r.pinner?.username ? `https://pinterest.com/${r.pinner.username}` : null
        }
      }))
    };
  } catch (e) {
    return { status: false, message: "❌ حدث خطأ أثناء البحث، أعد المحاولة لاحقًا.", error: e.message };
  }
}

// ✅ POST /api/pinterest
router.post('/', async (req, res) => {
  const { query } = req.body;
  if (!query)
    return res.status(400).json({ status: false, message: "⚠️ يرجى إرسال query" });

  const result = await searchPinterest(query);
  return res.status(result.status ? 200 : 500).json(result);
});

// ✅ GET /api/pinterest
router.get('/', async (req, res) => {
  const { query } = req.query;

  // لو فيه ?query=anime
  if (query) {
    const result = await searchPinterest(query);
    return res.status(result.status ? 200 : 500).json(result);
  }

  // لو مفيش query
  res.json({
    status: true,
    creator: "Dark-Team",
    message: "📌 أرسل POST إلى هذا الرابط مع { query: 'كلمة البحث' } أو GET بـ ?query=",
  });
});

export default router;
