// plugins/photo2anime-api.js
import express from "express";
import axios from "axios";
import fetch from "node-fetch";
import FormData from "form-data";

const router = express.Router();

function randomIP() {
  return Array(4).fill(0).map(() => Math.floor(Math.random() * 256)).join('.');
}

function randomUserAgent() {
  const userAgents = [
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Android 12; Mobile; rv:102.0) Gecko/102.0 Firefox/102.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function getBaseHeaders() {
  const sessionIP = randomIP();
  const sessionUA = randomUserAgent();
  return {
    'fp': 'c74f54010942b009eaa50cd58a1f4419',
    'fp1': '3LXezMA2LSO2kESzl2EYNEQBUWOCDQ/oQMQaeP5kWWHbtCWoiTptGi2EUCOLjkdD',
    'origin': 'https://pixnova.ai',
    'referer': 'https://pixnova.ai/',
    'theme-version': '83EmcUoQTUv50LhNx0VrdcK8rcGexcP35FcZDcpgWsAXEyO4xqL5shCY6sFIWB2Q',
    'x-code': '1752930995556',
    'x-guide': 'SjwMWX+LcTqkoPt48PIOgZzt3eQ93zxCGvzs1VpdikRR9b9+HvKM0Qiceq6Zusjrv8bUEtDGZdVqjQf/bdOXBb0vEaUUDRZ29EXYW0kt047grMMceXzd3zppZoHZj9DeXZOTGaG50PpTHxTjX3gb0D1wmfjol2oh7d5jJFSIsY0=',
    'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'accept': 'application/json, text/plain, */*',
    'user-agent': sessionUA,
    'X-Forwarded-For': sessionIP,
    'Client-IP': sessionIP
  };
}

async function uploadImageFromUrl(url) {
  const buffer = Buffer.from(await (await fetch(url)).arrayBuffer());
  const form = new FormData();
  form.append('file', buffer, { filename: 'image.jpg' });
  form.append('fn_name', 'demo-photo2anime');
  form.append('request_from', '2');
  form.append('origin_from', '111977c0d5def647');

  const upload = await axios.post('https://api.pixnova.ai/aitools/upload-img', form, {
    headers: { ...getBaseHeaders(), ...form.getHeaders() }
  });
  return upload.data?.data?.path;
}

async function createTask(sourceImage) {
  const payload = {
    fn_name: 'demo-photo2anime',
    call_type: 3,
    input: {
      source_image: sourceImage,
      strength: 0.6,
      prompt: 'use anime style, hd, 8k, smooth, aesthetic',
      negative_prompt: '(worst quality, low quality:1.4), cropped, blurry, text, watermark',
      request_from: 2
    },
    request_from: 2,
    origin_from: '111977c0d5def647'
  };

  const headers = { ...getBaseHeaders(), 'content-type': 'application/json' };
  const res = await axios.post('https://api.pixnova.ai/aitools/of/create', payload, { headers });
  return res.data?.data?.task_id;
}

async function waitForResult(taskId) {
  const payload = { task_id: taskId, fn_name: 'demo-photo2anime', call_type: 3, request_from: 2, origin_from: '111977c0d5def647' };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  for (let i = 1; i <= 30; i++) {
    const headers = { ...getBaseHeaders(), 'content-type': 'application/json' };
    const check = await axios.post('https://api.pixnova.ai/aitools/of/check-status', payload, { headers });
    const data = check.data?.data;
    if (data?.status === 2 && data?.result_image) {
      return data.result_image.startsWith('http') ? data.result_image : `https://oss-global.pixnova.ai/${data.result_image}`;
    }
    await delay(2000);
  }
  return null;
}

// ✅ API GET/POST
router.all("/", async (req, res) => {
  try {
    const imgurl = req.method === "GET" ? req.query.imgurl : req.body.imgurl;
    if (!imgurl) return res.status(400).json({ status: false, message: "❌ يرجى إرسال رابط الصورة" });

    const sourceImage = await uploadImageFromUrl(imgurl);
    const taskId = await createTask(sourceImage);
    const resultUrl = await waitForResult(taskId);

    if (!resultUrl) return res.status(500).json({ status: false, message: "❌ فشل في توليد الصورة" });

    res.json({ status: true, url: resultUrl });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});

export default router;