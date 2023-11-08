import { MarkdownRenderer, MarkdownView, Notice } from "obsidian";

import { OpenAI } from "openai";
// import * as path from "path";
// import * as fs from "fs";

// class CustomFormData extends FormData {
// 	getHeaders() {
// 		return {};
// 	}
// }

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

	api_call = async (
		prompt_list: { [key: string]: string }[],
		htmlEl?: HTMLElement,
		view?: MarkdownView
	) => {
		const streamMode = htmlEl !== undefined;

		try {
			const response = await this.apiFun.chat.completions.create({
				messages: prompt_list,
				model: this.modelName,
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
								view
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
			new Notice("## OpenAI API ## " + err);
		}
	};

	img_api_call = async (
		model: string,
		prompt: string,
		img_size: string,
		num_img: number,
		is_hd: boolean
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
			new Notice("## OpenAI API ## " + err);
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
			new Notice("## OpenAI API ## " + err);
		}
	};

	text_to_speech_call = async (input_text: string) => {
		const mp3 = await this.apiFun.audio.speech.create({
			model: "tts-1",
			voice: "alloy",
			input: input_text,
		});

		const blob = new Blob([await mp3.arrayBuffer()], { type: "audio/mp3" });
		const url = URL.createObjectURL(blob);
		const audio = new Audio(url);

		await audio.play();
	};
}
