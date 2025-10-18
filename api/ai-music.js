import express from 'express';
import axios from 'axios';

const router = express.Router();

router.all('/', async (req, res) => {
  try {
    let text = (req.query.text || req.body.text || '').toString();
    let prompt = text;
    let tags = 'pop, acoustic, happy';

    if (text.includes('|')) {
      const parts = text.split('|');
      prompt = parts[0].trim();
      tags = parts[1].trim();
    }

    if (!prompt) {
      return res.status(400).json({
        status: false,
        message: "❌︙الرجاء كتابة وصف للأغنية مثال: 'أغنية عن الحب | sad, futuristic'"
      });
    }

    const { data: lyricsResponse } = await axios.get('https://8pe3nv3qha.execute-api.us-east-1.amazonaws.com/default/llm_chat', {
      params: {
        query: JSON.stringify([
          {
            role: 'system',
            content: 'You are a professional lyricist AI trained to write poetic and rhythmic song lyrics. Respond with lyrics only, using [verse], [chorus], [bridge], and [instrumental] or [inst] tags to structure the song. Use only the tag (e.g., [verse]) without any numbering or extra text. Do not add explanations, titles, or any other text outside of the lyrics.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]),
        link: 'writecream.com'
      }
    });

    const lyrics = lyricsResponse.response_content;
    if (!lyrics) throw new Error('فشل في توليد الكلمات. جرب لاحقًا.');

    const session_hash = Math.random().toString(36).substring(2);
    await axios.post('https://ace-step-ace-step.hf.space/gradio_api/queue/join?', {
      data: [240, tags, lyrics, 60, 15, 'euler', 'apg', 10, '', 0.5, 0, 3, true, false, true, '', 0, 0, false, 0.5, null, 'none'],
      event_data: null,
      fn_index: 11,
      trigger_id: 45,
      session_hash
    });

    let audioUrl = null;
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const { data: queueData } = await axios.get(`https://ace-step-ace-step.hf.space/gradio_api/queue/data?session_hash=${session_hash}`);
      const raw = typeof queueData === 'string' ? queueData : JSON.stringify(queueData);
      const lines = raw.split('\n\n');
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        let d;
        try {
          d = JSON.parse(line.substring(6));
        } catch (e) {
          continue;
        }
        if (d.msg === 'process_completed' && Array.isArray(d.output?.data) && d.output.data[0]?.url) {
          audioUrl = d.output.data[0].url;
          break;
        } else if (d.msg === 'process_failed') {
          throw new Error('فشل توليد الموسيقى من الخادم.');
        }
      }
      if (audioUrl) break;
    }

    if (!audioUrl) throw new Error('⏳ لم يتم الحصول على الموسيقى. حاول مجددًا.');

    return res.status(200).json({
      status: true,
      message: '✅ تم توليد الأغنية بنجاح',
      lyrics,
      audio_url: audioUrl,
      signature: 'Dark TEAM'
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: '❌ حدث خطأ أثناء التوليد',
      error: error?.message || String(error)
    });
  }
});

export default router;
