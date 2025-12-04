import { Request, Response } from 'express';
import axios from 'axios';

export const proxyImage = async (req: Request, res: Response) => {
    try {
        const imageUrl = req.query.url as string;
        if (!imageUrl) {
            return res.status(400).send('Missing url query parameter');
        }

        console.log(`Proxying image: ${imageUrl}`);

        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const contentType = response.headers['content-type'];
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins
        res.send(response.data);

    } catch (error: any) {
        console.error('Error proxying image:', error.message);
        if (error.response) {
            console.error('Upstream status:', error.response.status);
            console.error('Upstream data:', error.response.data.toString());
        }
        res.status(500).send(`Failed to fetch image: ${error.message}`);
    }
};
