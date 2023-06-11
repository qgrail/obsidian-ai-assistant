import { MarkdownRenderer, MarkdownView, Notice } from "obsidian";

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
	apiKey: string;

	constructor(apiKey: string, modelName: string, maxTokens: number) {
		const configuration = new Configuration({
			apiKey: apiKey,
			formDataCtor: CustomFormData,
		});
		this.apiFun = new OpenAIApi(configuration);
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
