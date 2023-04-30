import { Notice } from "obsidian";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Configuration, OpenAIApi } = require("openai");

class CustomFormData extends FormData {
	getHeaders() {
		return {};
	}
}

export class OpenAI {
	modelName: string;
	apiFun: any;
	maxTokens: number;

	constructor(apiKey: string, modelName: string, maxTokens: number) {
		const configuration = new Configuration({
			apiKey: apiKey,
			formDataCtor: CustomFormData,
		});
		this.apiFun = new OpenAIApi(configuration);
		this.modelName = modelName;
		this.maxTokens = maxTokens;
	}
	api_call = async (prompt_list: { [key: string]: string }[]) => {
		try {
			const completion = await this.apiFun.createChatCompletion({
				model: this.modelName,
				messages: prompt_list,
				max_tokens: this.maxTokens,
			});
			return completion.data.choices[0].message.content;
		} catch (err) {
			new Notice("## OpenAI API ## " + err);
		}
	};

	img_api_call = async (
		prompt: string,
		img_size: string,
		num_img: number
	) => {
		try {
			const response = await this.apiFun.createImage({
				prompt: prompt,
				n: num_img,
				size: img_size,
			});
			return response.data.data.map((x: any) => x.url);
		} catch (err) {
			new Notice("## OpenAI API ## " + err);
		}
	};

	whisper_api_call = async (input: Blob, language: string) => {
		try {
			const completion = await this.apiFun.createTranscription(
				input,
				"whisper-1",
				undefined,
				undefined,
				undefined,
				language
			);
			return completion.data.text;
		} catch (err) {
			new Notice("## OpenAI API ## " + err);
		}
	};
}
