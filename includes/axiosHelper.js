const axios = require('axios');

async function getWithRetry(url, options = {}, retries = 3, delay = 1000) {
    try {
        return await axios.get(url, options);
    } catch (error) {
        if (error.response && error.response.status === 429 && retries > 0) {
            console.warn(`Rate limited (429). Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return getWithRetry(url, options, retries - 1, delay * 2);
        }
        throw error;
    }
}

module.exports = { getWithRetry };
