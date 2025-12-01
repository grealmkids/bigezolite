import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

// Credentials from .env
const B2_CONFIG = {
    region: process.env.B2_REGION || 'us-east-005',
    endpoint: process.env.B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com',
    credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY || ''
    },
    bucketName: process.env.B2_BUCKET_NAME || 'bigezo'
};

const s3Client = new S3Client({
    region: B2_CONFIG.region,
    endpoint: B2_CONFIG.endpoint,
    credentials: B2_CONFIG.credentials
});

export const uploadFileForSchool = async (schoolId: string | number, fileBuffer: Buffer, mimeType: string, originalName: string): Promise<string> => {
    const fileType = 'badge'; // For now we only upload badges
    const extension = originalName.split('.').pop() || 'png';
    const fileName = `${fileType}_${randomUUID()}.${extension}`;
    const key = `school-${schoolId}/students/${fileType}/${fileName}`;

    const command = new PutObjectCommand({
        Bucket: B2_CONFIG.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType
    });

    try {
        await s3Client.send(command);
        // Construct public URL (assuming bucket is public or we use the S3 URL)
        // Reference used: String.format("https://%s/%s", bucketName, filePath);
        return `https://${B2_CONFIG.bucketName}.s3.${B2_CONFIG.region}.backblazeb2.com/${key}`;
    } catch (error) {
        console.error('Error uploading file to B2:', error);
        throw new Error('Failed to upload file');
    }
};

export const deleteFileForSchool = async (fileUrl: string): Promise<void> => {
    try {
        // Extract key from URL
        // URL format: https://bigezo.s3.us-east-005.backblazeb2.com/school-1/students/badge/badge_uuid.png
        const urlParts = fileUrl.split('.com/');
        if (urlParts.length < 2) return;

        const key = urlParts[1];

        const command = new DeleteObjectCommand({
            Bucket: B2_CONFIG.bucketName,
            Key: key
        });

        await s3Client.send(command);
    } catch (error) {
        console.error('Error deleting file from B2:', error);
        // Don't throw, just log
    }
};
