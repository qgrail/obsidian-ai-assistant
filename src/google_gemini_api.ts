import { MarkdownRenderer, MarkdownView, Notice } from "obsidian";
const { GoogleGenerativeAI } = require("@google/generative-ai");


// ...
// https://ai.google.dev/models/gemini?hl=zh-cn

const models_list = [
    "gemini-pro", "gemini-pro-vision", "embedding-001", "aqa"
]


import { AiAssistantInterface, AiSettingTab } from "./api_interface";

export const GoogleGeminiSettingTab: AiSettingTab = {
    models: {
        "gemini-pro": "gemini-pro",
        "embedding-001": "embedding-001",
        "aqa": "aqa"
    },
    imgModels: {
        "gemini-pro-vision": "gemini-pro-vision",
    },
}

export class GoogleGeminiApi implements AiAssistantInterface {
    modelName: string;
    model: any;
    maxTokens: number;
    apiKey: string;

    constructor(apiKey: string, modelName: string, maxTokens: number) {
        this.modelName = modelName;
        this.apiKey = apiKey;
        this.maxTokens = maxTokens;

        console.log("Google Gemini API init.")
        console.log("Model name: " + modelName)
        console.log("Max tokens: " + maxTokens)
        console.log("API key: " + apiKey)
        try {
            if (!models_list.includes(modelName)) {
                throw new Error("Model not found.");
            }
            const genAI = new GoogleGenerativeAI(apiKey);
            this.model = genAI.getGenerativeModel({ model: modelName });
        } catch (error) {
            console.log(error);
            throw new Error(error);
        }
    }

    display_error = (err: any) => {
        if (err instanceof GoogleGenerativeAI.APIError) {
            new Notice("## Google Gemini API ## " + err);
        } else {
            new Notice(err);
        }
    };

    api_call = async (
        prompt_list: { [key: string]: string }[],
        htmlEl?: HTMLElement,
        view?: MarkdownView
    ) => {
        const streamMode = htmlEl !== undefined;

        try {
            // concatenate all prompts
            let prompt = "";
            prompt = prompt_list.map((p) => p.content).join("\n");
            console.log(prompt_list);
            console.log("Prompt: " + prompt);

            if (streamMode) {
                const result = await this.model.generateContentStream(prompt);

                let responseText = "";
                for await (const chunk of result.stream) {
                    const content = chunk.text();
                    if (content) {
                        responseText = responseText.concat(content);
                        htmlEl.innerHTML = "";
                        if (view) {
                            await MarkdownRenderer.renderMarkdown(
                                responseText,
                                htmlEl,
                                "",
                                view
                            );
                        } else {
                            htmlEl.innerHTML += responseText;
                        }
                    }
                }
                return htmlEl.innerHTML;
            }
            else {
                const result = await this.model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();
                // console.log("Response: " + text);
                return text;
            }
        } catch (err) {
            console.log(err);
            this.display_error(err);
        }
    };

    chat = async (
        prompt_list: { [key: string]: string }[],
        htmlEl: HTMLElement,
        view?: MarkdownView
    ) => {
        var new_prompt_list = prompt_list.map((p) => {
            return {
                role: p.role === "user" ? "user" : "model",
                parts: p.content,
            };
        });

        // get the last prompt and remove it from the list
        const last_prompt = new_prompt_list.pop();
        const msg = last_prompt?.parts;

        const chat_config = {
            history: new_prompt_list,
            generationConfig: {
                maxOutputTokens: this.maxTokens,
            }
        };

        const chat = this.model.startChat(chat_config);

        console.log("chat_config:\n", chat_config)
        console.log("msg:\n", msg);
    

        const result = await chat.sendMessage(msg);
        const response = await result.response;
        const text = response.text();
        console.log(text);

        let responseText = "";
        const content = response.text();
        if (content) {
            responseText = responseText.concat(content);
            htmlEl.innerHTML = "";
            if (view) {
                await MarkdownRenderer.renderMarkdown(
                    responseText,
                    htmlEl,
                    "",
                    view
                );
            } else {
                htmlEl.innerHTML += responseText;
            }
        }
        return htmlEl.innerHTML;
    }

    img_api_call = async (
        model: string,
        prompt: string,
        img_size: string,
        num_img: number,
        is_hd: boolean
    ) => {
        throw new Error("Method not implemented for Goole Gemini.");
    }
}