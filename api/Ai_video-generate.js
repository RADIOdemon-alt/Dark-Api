import express from 'express';
import axios from 'axios';

const router = express.Router();

const aiLabs = {
  api: {
    base: 'https://text2pet.zdex.top',
    endpoints: {
      images: '/images',
      videos: '/videos',
      videosBatch: '/videos/batch'
    }
  },

  headers: {
    'user-agent': 'NB Android/1.0.0',
    'accept-encoding': 'gzip',
    'content-type': 'application/json',
    authorization: ''
  },

  state: { token: null },

  setup: {
    cipher: 'hbMcgZLlzvghRlLbPcTbCpfcQKM0PcU0zhPcTlOFMxBZ1oLmruzlVp9remPgi0QWP0QW',
    shiftValue: 3,

    dec(text, shift) {
      return [...text].map(c =>
        /[a-z]/.test(c)
          ? String.fromCharCode((c.charCodeAt(0) - 97 - shift + 26) % 26 + 97)
          : /[A-Z]/.test(c)
          ? String.fromCharCode((c.charCodeAt(0) - 65 - shift + 26) % 26 + 65)
          : c
      ).join('');
    },

    decrypt: async () => {
      if (aiLabs.state.token) return aiLabs.state.token;
      const input = aiLabs.setup.cipher;
      const shift = aiLabs.setup.shiftValue;
      const decrypted = aiLabs.setup.dec(input, shift);
      aiLabs.state.token = decrypted;
      aiLabs.headers.authorization = decrypted;
      return decrypted;
    }
  },

  deviceId() {
    return Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  },

  text2img: async (prompt) => {
    if (!prompt?.trim()) return { success: false, code: 400, error: '⚠️ النص فارغ يا زعيم' };
    await aiLabs.setup.decrypt();
    const payload = { prompt };

    try {
      const url = aiLabs.api.base + aiLabs.api.endpoints.images;
      const res = await axios.post(url, payload, { headers: aiLabs.headers });
      const { code, data, prompt: isPrompt } = res.data;

      if (code !== 0 || !data) return { success: false, code: res.status, error: '❌ فشل في إنشاء الصورة' };
      return { success: true, code: res.status, url: data, prompt: isPrompt || prompt };
    } catch (err) {
      return { success: false, code: err.response?.status || 500, error: err.message || '❌ خطأ غير معروف' };
    }
  },

  generate: async ({ prompt = '', model = 'vid', isPremium = 1 } = {}) => {
    if (!prompt?.trim()) return { success: false, code: 400, error: '⚠️ النص فارغ يا زعيم' };

    if (model === 'img') {
      return await aiLabs.text2img(prompt);
    } else if (model === 'vid') {
      await aiLabs.setup.decrypt();
      const payload = {
        deviceID: aiLabs.deviceId(),
        isPremium,
        prompt,
        used: [],
        versionCode: 6
      };

      try {
        const url = aiLabs.api.base + aiLabs.api.endpoints.videos;
        const res = await axios.post(url, payload, { headers: aiLabs.headers });
        const { code, key } = res.data;
        if (code !== 0 || !key) return { success: false, code: res.status, error: '❌ فشل في الحصول على مفتاح الفيديو' };
        return await aiLabs.video(key);
      } catch (err) {
        return { success: false, code: err.response?.status || 500, error: err.message || '❌ خطأ غير معروف' };
      }
    } else {
      return { success: false, code: 400, error: '⚠️ الموديل غير معروف، استخدم img أو vid فقط' };
    }
  },

  video: async (key) => {
    if (!key) return { success: false, code: 400, error: '⚠️ المفتاح غير صالح' };
    await aiLabs.setup.decrypt();

    const payload = { keys: [key] };
    const url = aiLabs.api.base + aiLabs.api.endpoints.videosBatch;
    const maxAttempts = 100;
    const delay = 2000;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const res = await axios.post(url, payload, { headers: aiLabs.headers, timeout: 15000 });
        const { code, datas } = res.data;
        if (code === 0 && Array.isArray(datas) && datas.length > 0) {
          const data = datas[0];
          if (data.url && data.url.trim() !== '') {
            return { success: true, code: res.status, url: data.url.trim(), progress: '100%' };
          }
        }
      } catch {}
      await new Promise(r => setTimeout(r, delay));
    }

    return { success: false, code: 504, error: '⏳ انتهى الوقت ولم يكتمل إنشاء الفيديو' };
  }
};

// ================== ROUTE ==================
router.get('/', async (req, res) => {
  const { prompt, model } = req.query;

  if (!prompt)
    return res.status(400).json({ success: false, error: '⚠️ الرجاء إدخال prompt' });

  const result = await aiLabs.generate({ prompt, model });
  res.status(result.code || 500).json(result);
});

export default router;