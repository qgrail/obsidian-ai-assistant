import { MarkdownRenderer, MarkdownView, Notice } from "obsidian";

import { OpenAI } from "openai";
import * as path from "path";
import * as fs from "fs";

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
			const response = await fetch(
				"https://api.openai.com/v1/chat/completions",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify({
						model: this.modelName,
						max_tokens: this.maxTokens,
						messages: prompt_list,
						stream: streamMode,
					}),
				}
			);
			if (streamMode) {
				const reader = response.body?.getReader();
				const textDecoder = new TextDecoder("utf-8");

				if (!reader) {
					throw new Error("Error: fail to read data from response");
				}

				let responseText = "";
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const chunk = textDecoder.decode(value);

					let currentText = "";
					for (const line of chunk.split("\n")) {
						const trimmedLine = line.trim();

						if (!trimmedLine || trimmedLine === "data: [DONE]") {
							continue;
						}

						const response = JSON.parse(
							trimmedLine.replace("data: ", "")
						);
						const content = response.choices[0].delta.content;
						if (!content) continue;

						currentText = currentText.concat(content);
					}
					responseText += currentText;
					// Reset inner HTML before rendering Markdown
					htmlEl.innerHTML = "";
					if (streamMode) {
						if (view) {
							await MarkdownRenderer.renderMarkdown(
								responseText,
								htmlEl,
								"",
								view
							);
						} else {
							htmlEl.innerHTML += currentText;
						}
					}
				}
				return htmlEl.innerHTML;
			} else {
				const data = await response.json();
				return data.choices[0].message.content;
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
