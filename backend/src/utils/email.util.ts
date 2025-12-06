export const sendEmail = async (to: string, subject: string, text: string): Promise<void> => {
    // Mock email sending for now
    console.log(`[Mock Email] To: ${to}, Subject: ${subject}, Body: ${text}`);
    return Promise.resolve();
};
