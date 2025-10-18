import express from 'express';
import translate from 'google-translate-api-x';

const app = express();


const router = express.Router();

router.get('/', async (req, res) => {
    const { text, lang } = req.query;

    if (!text) {
        return res.status(400).json({
            status: 'false',
            creator: '𝑅𝐴𝐷𝐼𝛩 𝐷𝐸𝑀𝛩𝑁',
            result: 'يرجى تقديم نص للترجمة'
        });
    }


    if (!lang) {
        return res.status(400).json({
            status: 'false',
            creator: '𝑅𝐴𝐷𝐼𝛩 𝐷𝐸𝑀𝛩𝑁',
            result: 'errorr'
        });
    }

    try {
        const result = await translate(text, { to: lang });
        return res.json({
            status: 'true',
            creator: '𝑅𝐴𝐷𝐼𝛩 𝐷𝐸𝑀𝛩𝑁',
            result: result.text
        });
    } catch (error) {
        return res.status(500).json({
            status: 'false',
            creator: '𝑅𝐴𝐷𝐼𝛩 𝐷𝐸𝑀𝛩𝑁',
            result: 'errorr'
        });
    }
});

export default router;
