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
		const completion = await this.apiFun
			.createChatCompletion({
				model: this.modelName,
				messages: prompt_list,
				max_tokens: this.maxTokens,
			})
			.catch(() => {
				new Notice("Error in API call");
			});

		return completion.data.choices[0].message.content;
	};
}
