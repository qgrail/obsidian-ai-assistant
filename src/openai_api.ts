import { MarkdownRenderer, MarkdownView, Notice } from "obsidian";

import { OpenAI } from "openai";
import { request } from "obsidian";

export class OpenAIAssistant {
	modelName: string;
	apiFun: any;
	maxTokens: number;
	apiKey: string;

	constructor(apiKey: string, modelName: string, maxTokens: number) {
		this.apiFun = new OpenAI({
			apiKey: apiKey,
			dangerouslyAllowBrowser: true,
		});
		this.modelName = modelName;
		this.maxTokens = maxTokens;
		this.apiKey = apiKey;
	}

	display_error = (err: any) => {
		if (err instanceof OpenAI.APIError) {
			new Notice(`## OpenAI API Error: ${err}.`);
		} else {
			new Notice(err);
		}
	};

	text_api_call = async (
		prompt_list: { [key: string]: string }[],
		htmlEl?: HTMLElement,
		view?: MarkdownView,
	) => {
		const streamMode = htmlEl !== undefined;
		const has_img = prompt_list.some((el) => Array.isArray(el.content));
		let model = this.modelName;
		if (has_img && !["gpt-4o", "gpt-4-turbo"].includes(model)){
			model = "gpt-4o";
		}
		try {
			const response = await this.apiFun.chat.completions.create({
				messages: prompt_list,
				model: model,
				max_tokens: this.maxTokens,
				stream: streamMode,
			});

			if (streamMode) {
				let responseText = "";
				for await (const chunk of response) {
					const content = chunk.choices[0].delta.content;
					if (content) {
						responseText = responseText.concat(content);
						htmlEl.innerHTML = "";
						if (view) {
							await MarkdownRenderer.renderMarkdown(
								responseText,
								htmlEl,
								"",
								view,
							);
						} else {
							htmlEl.innerHTML += responseText;
						}
					}
				}
				return htmlEl.innerHTML;
			} else {
				return response.choices[0].message.content;
			}
		} catch (err) {
			this.display_error(err);
		}
	};

	img_api_call = async (
		model: string,
		prompt: string,
		img_size: string,
		num_img: number,
		is_hd: boolean,
	) => {
		try {
			const params: { [key: string]: string | number } = {};
			params.model = model;
			params.prompt = prompt;
			params.n = num_img;
			params.size = img_size;

			if (model === "dall-e-3" && is_hd) {
				params.quality = "hd";
			}

			const response = await this.apiFun.images.generate(params);
			return response.data.map((x: any) => x.url);
		} catch (err) {
			this.display_error(err);
		}
	};

	whisper_api_call = async (input: Blob, language: string) => {
		try {
			const completion = await this.apiFun.audio.transcriptions.create({
				file: input,
				model: "whisper-1",
				language: language,
			});
			return completion.text;
		} catch (err) {
			this.display_error(err);
		}
	};

	text_to_speech_call = async (input_text: string) => {
		try {
			const mp3 = await this.apiFun.audio.speech.create({
				model: "tts-1",
				voice: "alloy",
				input: input_text,
			});

			const blob = new Blob([await mp3.arrayBuffer()], {
				type: "audio/mp3",
			});
			const url = URL.createObjectURL(blob);
			const audio = new Audio(url);

			await audio.play();
		} catch (err) {
			this.display_error(err);
		}
	};
}

export class AnthropicAssistant extends OpenAIAssistant {
	anthropicApiKey: string;

	constructor(
		openAIapiKey: string,
		anthropicApiKey: string,
		modelName: string,
		maxTokens: number,
	) {
		super(openAIapiKey, modelName, maxTokens);

		this.anthropicApiKey = anthropicApiKey;
	}

	text_api_call = async (
		prompt_list: { [key: string]: string }[],
		htmlEl?: HTMLElement,
		view?: MarkdownView,
	) => {
		try {
			const response = await request({
				url: "https://api.anthropic.com/v1/messages",

				method: "POST",

				headers: {
					"x-api-key": this.anthropicApiKey,
					"anthropic-version": "2023-06-01",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					model: this.modelName,
					max_tokens: this.maxTokens,
					messages: prompt_list,
					// Stream mode not implemented yet.
					stream: false,
				}),
			});

			return JSON.parse(response).content[0].text;
		} catch (err) {
			this.display_error(err);
		}
	};
}

export class OllamaAssistant extends OpenAIAssistant {
	apiAddress: string;

	constructor(apiAddress: string, modelName: string, maxTokens: number) {
		super("", modelName, maxTokens);
		this.apiAddress = apiAddress;
	}

	text_api_call = async (
		prompt_list: { [key: string]: string }[],
		htmlEl?: HTMLElement,
		view?: MarkdownView,
	) => {
		try {
			const response = await request({
				url: `${this.apiAddress}/api/chat`,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: this.modelName,
					messages: prompt_list,
					stream: false,
					options: {
						num_predict: this.maxTokens,
					},
				}),
			});

			return JSON.parse(response).message.content;
		} catch (err) {
			this.display_error(err);
		}
	};
}
