import { MarkdownView, Notice, request } from "obsidian";

import { OpenAI } from "openai";

import { DEFAULT_OAI_IMAGE_MODEL, OAI_IMAGE_CAPABLE_MODELS } from "./settings";

export class BaseAssistant {
    modelName: string;
    apiKey: string;
    maxTokens: number;

    constructor(apiKey: string, modelName: string, maxTokens: number) {
        this.apiKey = apiKey;
        this.modelName = modelName;
        this.maxTokens = maxTokens;
    }

    display_error(err: any) {
        new Notice(`API Error: ${err}`);
    }

    async text_api_call(
        prompt_list: { [key: string]: string }[],
        htmlEl?: HTMLElement,
        view?: MarkdownView,
    ): Promise<string | undefined> {
        throw new Error("text_api_call not implemented");
    }
    
    async img_api_call(
        model: string,
        prompt: string,
        img_size: string,
        num_img: number,
        is_hd: boolean,
    ): Promise<string[] | undefined> {
        throw new Error("img_api_call not implemented");
    }
    
    async whisper_api_call(
        input: Blob,
        language: string,
    ): Promise<string | undefined> {
        throw new Error("whisper_api_call not implemented");
    }
    
    async text_to_speech_call(
        input_text: string,
    ): Promise<void> {
        throw new Error("text_to_speech_call not implemented");
    }
}

export class OpenAIAssistant extends BaseAssistant {
	apiFun: any;

	constructor(apiKey: string, modelName: string, maxTokens: number) {
		super(apiKey, modelName, maxTokens);
		this.apiFun = new OpenAI({
			apiKey: apiKey,
			dangerouslyAllowBrowser: true,
		});
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
	): Promise<string | undefined> => {
		const streamMode = htmlEl !== undefined;
		const has_img = prompt_list.some((el) => Array.isArray(el.content));
		let model = this.modelName;

		if (has_img && !OAI_IMAGE_CAPABLE_MODELS.includes(model)) {
			model = DEFAULT_OAI_IMAGE_MODEL;
		}
		try {
			const is_reasonning_model = /o[124]/.test(model);
			const params = {
				messages: prompt_list,
				model: model,
				stream: streamMode,
				...(is_reasonning_model
					? { max_completion_tokens: this.maxTokens }
					: { max_tokens: this.maxTokens }),
			};

			const response = await this.apiFun.chat.completions.create(params);

			if (streamMode) {
				let responseText = "";
				for await (const chunk of response) {
					const content = chunk.choices[0].delta.content;
					if (content) {
						responseText = responseText.concat(content);
						htmlEl.innerHTML = responseText;
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
	): Promise<string[] | undefined> => {
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

	whisper_api_call = async (input: Blob, language: string): Promise<string | undefined> => {
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

	text_to_speech_call = async (input_text: string): Promise<void> => {
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

export class AnthropicAssistant extends BaseAssistant {
	display_error(err: any) {
        new Notice(`Anthropic API Error: ${err}`);
    }

	text_api_call = async (
		prompt_list: { [key: string]: string }[],
		htmlEl?: HTMLElement,
		view?: MarkdownView,
	): Promise<string | undefined> => {
		try {
			const response = await request({
				url: "https://api.anthropic.com/v1/messages",

				method: "POST",

				headers: {
					"x-api-key": this.apiKey,
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

	img_api_call = async (
		model: string,
		prompt: string,
		img_size: string,
		num_img: number,
		is_hd: boolean,
	): Promise<string[] | undefined> => {
		this.display_error("Image generation not supported by Anthropic API");
		return undefined;
	};

	whisper_api_call = async (
		input: Blob,
		language: string,
	): Promise<string | undefined> => {
		this.display_error("Speech-to-text not supported by Anthropic API");
		return undefined;
	};

	text_to_speech_call = async (
		input_text: string,
	): Promise<void> => {
		this.display_error("Text-to-speech not supported by Anthropic API");
	};
}

export class PerplexityAssistant extends BaseAssistant {
	display_error(err: any) {
        new Notice(`Perplexity API Error: ${err}`);
    }

	text_api_call = async (
		prompt_list: { [key: string]: string }[],
		htmlEl?: HTMLElement,
		view?: MarkdownView,
	): Promise<string | undefined> => {
		const streamMode = htmlEl !== undefined;
		const has_img = prompt_list.some((el) => Array.isArray(el.content));
		
		// Check if model supports images (sonar-deep-research doesn't)
		if (has_img && this.modelName === "sonar-deep-research") {
			this.display_error("sonar-deep-research model does not support image input");
			return undefined;
		}
		
		try {
			const response = await request({
				url: "https://api.perplexity.ai/chat/completions",
				method: "POST",
				headers: {
					"Authorization": `Bearer ${this.apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: this.modelName,
					messages: prompt_list,
					max_tokens: this.maxTokens,
					stream: streamMode,
					temperature: 0.2,
				}),
			});

			if (streamMode) {
				// Note: Streaming implementation would need server-sent events parsing
				// For now, fall back to non-streaming
				const data = JSON.parse(response);
				const content = data.choices[0].message.content;
				if (htmlEl && content) {
					htmlEl.innerHTML = content;
				}
				return content;
			} else {
				const data = JSON.parse(response);
				return data.choices[0].message.content;
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
	): Promise<string[] | undefined> => {
		this.display_error("Image generation not supported by Perplexity API");
		return undefined;
	};

	whisper_api_call = async (
		input: Blob,
		language: string,
	): Promise<string | undefined> => {
		this.display_error("Speech-to-text not supported by Perplexity API");
		return undefined;
	};

	text_to_speech_call = async (
		input_text: string,
	): Promise<void> => {
		this.display_error("Text-to-speech not supported by Perplexity API");
	};
}
