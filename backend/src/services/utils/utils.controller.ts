import { Request, Response } from 'express';
import axios from 'axios';

export const proxyImage = async (req: Request, res: Response) => {
    try {
        const imageUrl = req.query.url as string;
        if (!imageUrl) {
            return res.status(400).send('Missing url query parameter');
        }

        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer'
        });

        const contentType = response.headers['content-type'];
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins
        res.send(response.data);

    } catch (error) {
        console.error('Error proxying image:', error);
        res.status(500).send('Failed to fetch image');
    }
};
