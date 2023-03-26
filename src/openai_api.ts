import { Notice } from "obsidian";

const { Configuration, OpenAIApi } = require("openai");

export class OpenAI {
	modelName: string;
	apiFun: any;
	maxTokens: number;

	constructor(apiKey: string, modelName: string, maxTokens: number) {
		const configuration = new Configuration({
			apiKey: apiKey,
		});
		this.apiFun = new OpenAIApi(configuration);
		this.modelName = modelName;
		this.maxTokens = maxTokens;
	}
	api_call = async (prompt_list: { [key: string]: string }[]) => {
		console.log(this.modelName);
		try {
			const completion = await this.apiFun.createChatCompletion({
				model: this.modelName,
				messages: prompt_list,
				max_tokens: this.maxTokens,
			});
			console.log(completion);
			return completion.data.choices[0].message.content;
		} catch (err) {
			new Notice("Error in API call !");
		}
	};

	img_api_call = async (prompt: string, img_size: string) => {
		try {
			const response = await this.apiFun.createImage({
				prompt: prompt,
				n: 1,
				size: img_size,
			});
			return response.data.data[0].url;
		} catch (err) {
			new Notice("Error in API call !");
		}
	};
}
