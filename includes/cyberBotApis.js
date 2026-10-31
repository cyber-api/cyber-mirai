class cyberBotApis {
    constructor() {
        // TODO: replace mahbub-shaon with your real API host.
        this.baseURL = "https://mahbub-shaon.cyberbot.top";
    }

    // Example endpoints as getters
    get exampleEndpoint() {
        return `${this.baseURL}/api/example`;
    }

    get userInfo() {
        return `${this.baseURL}/api/user/info`;
    }

    get download() {
        return `${this.baseURL}/api/download`;
    }

    get search() {
        return `${this.baseURL}/api/search`;
    }

    // You can add more endpoints here
}

module.exports = cyberBotApis;
