import {
	App,
	Editor,
	MarkdownRenderer,
	MarkdownView,
	Modal,
	Notice,
	requestUrl,
} from "obsidian";
import { AnthropicAssistant, OpenAIAssistant } from "./openai_api";

function generateUniqueId() {
	return "_" + Math.random().toString(36).substr(2, 9);
}

function format_prompt_table(prompt_table: { [key: string]: any }[]) {
	/**
	 * Format the list of prompt to a valid one.
	 * All elements should have an id: if not generate one.
	 * First element should be a user message: if not add "Hello" one,
	 * Then an assistant message, then a user message, etc: if two consecutive messages are from the same role, they are merged.
	 */

	// Add first user message if not present.
	if (prompt_table[0].role !== "user") {
		prompt_table.unshift({
			id: generateUniqueId(),
			role: "user",
			content: "Hello",
		});
	}

	for (let i = 0; i < prompt_table.length; i++) {
		const current = prompt_table[i];

		// Merge consecutive messages from the same role
		if (i > 0 && current.role === prompt_table[i - 1].role) {
			if (
				Array.isArray(prompt_table[i - 1].content) &&
				!Array.isArray(current.content)
			) {
				prompt_table[i - 1].content.push({
					type: "text",
					text: current.content,
				});
			} else if (
				Array.isArray(current.content) &&
				!Array.isArray(prompt_table[i - 1].content)
			) {
				prompt_table[i - 1].content = [
					{ type: "text", text: prompt_table[i - 1].content },
					...current.content,
				];
			} else if (
				Array.isArray(current.content) &&
				Array.isArray(prompt_table[i - 1].content)
			) {
				prompt_table[i - 1].content = [
					...prompt_table[i - 1].content,
					...current.content,
				];
			} else {
				prompt_table[i - 1].content += "\n\n" + current.content;
			}
			prompt_table.splice(i, 1);
			i--; // Adjust the index since we've modified the array
		}
	}
}

export class PromptModal extends Modal {
	param_dict: { [key: string]: string };
	onSubmit: (input_dict: object) => void;
	is_img_modal: boolean;
	settings: { [key: string]: string };

	constructor(
		app: App,
		onSubmit: (x: object) => void,
		is_img_modal: boolean,
		settings: { [key: string]: string },
	) {
		super(app);
		this.onSubmit = onSubmit;
		this.settings = settings;
		this.is_img_modal = is_img_modal;
		this.param_dict = {
			num_img: "1",
			is_hd: "true",
		};
	}

	build_image_modal() {
		this.titleEl.setText("What can I generate for you?");
		const prompt_container = this.contentEl.createEl("div", {
			cls: "prompt-modal-container",
		});
		this.contentEl.append(prompt_container);

		const prompt_left_container = prompt_container.createEl("div", {
			cls: "prompt-left-container",
		});

		const desc1 = prompt_left_container.createEl("p", {
			cls: "description",
		});
		desc1.innerText = "Resolution";

		const prompt_right_container = prompt_container.createEl("div", {
			cls: "prompt-right-container",
		});

		const resolution_dropdown = prompt_right_container.createEl("select");

		let options = ["256x256", "512x512", "1024x1024"];
		this.param_dict["img_size"] = "256x256";

		if (this.settings["model"] === "dall-e-3") {
			options = ["1024x1024", "1792x1024", "1024x1792"];
			this.param_dict["img_size"] = "1024x1024";
		}

		options.forEach((option) => {
			const optionEl = resolution_dropdown.createEl("option", {
				text: option,
			});
			optionEl.value = option;
			if (option === this.param_dict["img_size"]) {
				optionEl.selected = true;
			}
		});
		resolution_dropdown.addEventListener("change", (event) => {
			const selectElement = event.target as HTMLSelectElement;
			this.param_dict["img_size"] = selectElement.value;
		});

		if (this.settings["model"] === "dall-e-2") {
			const desc2 = prompt_left_container.createEl("p", {
				cls: "description",
			});
			desc2.innerText = "Num images";

			const num_img_dropdown = prompt_right_container.createEl("select");
			const num_choices = [...Array(10).keys()].map((x) =>
				(x + 1).toString(),
			);
			num_choices.forEach((option) => {
				const optionEl = num_img_dropdown.createEl("option", {
					text: option,
				});
				optionEl.value = option;
				if (option === this.param_dict["num_img"]) {
					optionEl.selected = true;
				}
			});
			num_img_dropdown.addEventListener("change", (event) => {
				const selectElement = event.target as HTMLSelectElement;
				this.param_dict["num_img"] = selectElement.value;
			});
		}
		if (this.settings["model"] === "dall-e-3") {
			const desc2 = prompt_left_container.createEl("p", {
				cls: "description",
			});
			desc2.innerText = "HD?";
			const is_hd = prompt_right_container.createEl("input", {
				type: "checkbox",
			});
			is_hd.checked = this.param_dict["is_hd"] === "true";
			is_hd.addEventListener("change", (event) => {
				this.param_dict["is_hd"] = is_hd.checked.toString();
			});
		}
	}

	submit_action() {
		if (this.param_dict["prompt_text"]) {
			this.close();
			this.onSubmit(this.param_dict);
		}
	}

	onOpen() {
		const { contentEl } = this;
		this.titleEl.setText("What can I do for you?");

		const input_container = contentEl.createEl("div", {
			cls: "chat-button-container-right",
		});

		const input_field = input_container.createEl("input", {
			placeholder: "Your prompt here",
			type: "text",
		});
		input_field.addEventListener("keypress", (evt) => {
			if (evt.key === "Enter") {
				this.param_dict["prompt_text"] = input_field.value.trim();
				this.submit_action();
			}
		});

		const submit_btn = input_container.createEl("button", {
			text: "Submit",
			cls: "mod-cta",
		});
		submit_btn.addEventListener("click", () => {
			this.param_dict["prompt_text"] = input_field.value.trim();
			this.submit_action();
		});

		input_field.focus();
		input_field.select();

		if (this.is_img_modal) {
			this.build_image_modal();
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}

export class ChatModal extends Modal {
	prompt_text: string;
	prompt_table: { [key: string]: any }[] = [];
	aiAssistant: any;
	is_generating_answer: boolean;

	constructor(app: App, assistant: OpenAIAssistant) {
		super(app);
		this.aiAssistant = assistant;
		this.is_generating_answer = false;
	}

	clearModalContent() {
		this.contentEl.innerHTML = "";
		this.prompt_text = "";
	}

	is_anthropic_img = (el: any): boolean => {
		return (
			Array.isArray(el["content"]) &&
			el["content"][el["content"].length - 1]["type"] === "image" &&
			"source" in el["content"][el["content"].length - 1]
		);
	};

	send_action = async () => {
		if (this.prompt_text && !this.is_generating_answer) {
			this.is_generating_answer = true;

			// For Anthropic, we need to merge text and image in the same content.
			let merge_text_img = false;
			if (this.prompt_table.length > 0) {
				const lastElement =
					this.prompt_table[this.prompt_table.length - 1];
				if (this.is_anthropic_img(lastElement)) {
					lastElement["content"].push({
						type: "text",
						text: this.prompt_text,
					});
					merge_text_img = true;
				}
			}

			if (!merge_text_img) {
				this.prompt_table.push({
					role: "user",
					content: this.prompt_text,
					id: generateUniqueId(),
				});
			}

			format_prompt_table(this.prompt_table);

			this.prompt_table.push({
				role: "assistant",
				content: "Generating Answer...",
				id: generateUniqueId(),
			});

			this.clearModalContent();
			await this.displayModalContent();

			this.prompt_table.pop();
			const answers =
				this.modalEl.getElementsByClassName("chat-div assistant");
			const view = this.app.workspace.getActiveViewOfType(
				MarkdownView,
			) as MarkdownView;
			const parsed_prompts = this.prompt_table.map((item) =>
				Object.fromEntries(
					Object.entries(item).filter(([key]) => key !== "id"),
				),
			);
			const answer = await this.aiAssistant.text_api_call(
				parsed_prompts,
				answers[answers.length - 1],
				view,
			);
			if (answer) {
				this.prompt_table.push({
					role: "assistant",
					content: answer,
					id: generateUniqueId(),
				});
			}
			this.clearModalContent();
			await this.displayModalContent();
			this.is_generating_answer = false;
		}
	};

	displayModalContent = async () => {
		const { contentEl } = this;
		const container = this.contentEl.createEl("div", {
			cls: "chat-modal-container",
		});
		const view = this.app.workspace.getActiveViewOfType(
			MarkdownView,
		) as MarkdownView;

		for (const [index, x] of this.prompt_table.entries()) {
			const div = container.createEl("div", {
				cls: `chat-div ${x["role"]}`,
			});

			// Add a delete button
			div.style.position = "relative";
			const deleteBtn = div.createEl("button", {
				cls: "delete-btn",
				text: "X",
			});
			deleteBtn.contentEditable = "false";
			deleteBtn.style.position = "absolute";
			deleteBtn.style.top = "0";
			deleteBtn.style.right = "0";
			deleteBtn.style.display = "none";

			if (x["role"] === "assistant") {
				await MarkdownRenderer.renderMarkdown(
					x["content"],
					div,
					"",
					view,
				);
			} else {
				if (Array.isArray(x["content"])) {
					x["content"].forEach((content) => {
						if (content["type"] === "text") {
							div.createEl("p", {
								text: content["text"],
							});
						} else {
							const image = div.createEl("img", {
								cls: "image-modal-image",
							});
							if ("source" in content) {
								image.setAttribute(
									"src",
									`data:${content["source"]["media_type"]};base64,${content["source"]["data"]}`,
								);
							} else {
								image.setAttribute(
									"src",
									content["image_url"]["url"],
								);
							}
						}
					});
				} else {
					div.createEl("p", {
						text: x["content"],
					});
				}
			}

			div.dataset.entryId = x["id"];

			div.addEventListener("click", async () => {
				// div.contentEditable = "true";
				// div.focus();
				deleteBtn.style.display = "block";
			});

			// div.onblur = () => {
			// 	const newText = div.innerText;
			// 	if (this.prompt_table[index]["content"] !== newText) {
			// 		this.prompt_table[index]["content"] = newText;
			// 	}
			// 	div.contentEditable = "false";
			// 	deleteBtn.style.display = "none";
			// };

			deleteBtn.addEventListener("click", (event) => {
				const entryId = div.dataset.entryId; // Assume you've stored the unique ID in the dataset when creating the div
				div.remove();

				this.prompt_table = this.prompt_table.filter(
					(entry) => entry.id !== entryId,
				);
				console.log("Prompt table after deletion", this.prompt_table);
			});
		}

		const button_container = contentEl.createEl("div", {
			cls: "chat-button-container",
		});

		button_container.createEl("p", {
			text: "Type here:",
		});

		const right_button_container = button_container.createEl("div", {
			cls: "chat-button-container-right",
		});

		// Upload image from file
		const hidden_add_file_button = right_button_container.createEl(
			"input",
			{
				type: "file",
				cls: "hidden-file",
			},
		);
		hidden_add_file_button.setAttribute("accept", ".png, .jpg, .jpeg");

		hidden_add_file_button.addEventListener("change", async (e: Event) => {
			const files = (e.target as HTMLInputElement).files;

			if (files && files.length > 0) {
				const base64String = await convertBlobToBase64(files[0]);
				let content;
				if (this.aiAssistant instanceof AnthropicAssistant) {
					const [type, data] = decode_base64(base64String);
					content = {
						type: "image",
						source: {
							type: "base64",
							media_type: type,
							data: data,
						},
					};
				} else {
					content = {
						type: "image_url",
						image_url: {
							url: base64String,
							detail: "auto",
						},
					};
				}
				this.prompt_table.push({
					role: "user",
					content: [content],
					id: generateUniqueId(),
				});

				this.clearModalContent();
				this.displayModalContent();
			}
		});

		// Create a simple button element that will function as the add_file_button
		const add_file_button = right_button_container.createEl("button");
		add_file_button.innerHTML = "&#x1F4F7;";

		// Programmatically trigger hidden_add_file_button click
		add_file_button.addEventListener("click", () => {
			hidden_add_file_button.click();
		});

		const input_field = right_button_container.createEl("input", {
			placeholder: "Your prompt here",
			type: "text",
		});
		input_field.addEventListener("keypress", (evt) => {
			if (evt.key === "Enter") {
				this.prompt_text = input_field.value.trim();
				this.send_action();
			}
		});

		const submit_btn = right_button_container.createEl("button", {
			text: "Submit",
			cls: "mod-cta",
		});
		submit_btn.addEventListener("click", () => {
			this.prompt_text = input_field.value.trim();
			this.send_action();
		});

		input_field.focus();
		input_field.select();

		const button_container_2 = contentEl.createEl("div", {
			cls: "chat-button-container-right upper-border",
		});

		const clear_button = button_container_2.createEl("button", {
			text: "Clear",
		});
		const copy_button = button_container_2.createEl("button", {
			text: "Copy conversation",
		});

		clear_button.addEventListener("click", () => {
			this.prompt_table = [];
			this.clearModalContent();
			this.displayModalContent();
		});
		copy_button.addEventListener("click", async () => {
			const conversation = this.prompt_table
				.map((x) => x["content"])
				.join("\n\n");
			await navigator.clipboard.writeText(conversation);
			new Notice("Conversation copied to clipboard");
		});

		const convertBlobToBase64 = (blob: Blob): Promise<string> => {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onerror = () => reject(reader.error);
				reader.onload = () => {
					resolve(reader.result as string);
				};
				reader.readAsDataURL(blob);
			});
		};

		const decode_base64 = (input: string): [string, string] => {
			const commaIndex = input.indexOf(",");
			const semiIndex = input.indexOf(";");
			const dotIndex = input.indexOf(":");
			const type = input.slice(dotIndex + 1, semiIndex);
			const data = input.slice(commaIndex + 1);

			return [type, data];
		};
	};

	onOpen() {
		this.titleEl.setText("What can I do for you?");
		this.displayModalContent();
	}

	onClose() {
		this.contentEl.empty();
	}
}

export class ImageModal extends Modal {
	imageUrls: string[];
	selectedImageUrls: string[];
	assetFolder: string;

	constructor(
		app: App,
		imageUrls: string[],
		title: string,
		assetFolder: string,
	) {
		super(app);
		this.imageUrls = imageUrls;
		this.selectedImageUrls = [];
		this.titleEl.setText(title);
		this.assetFolder = assetFolder;
	}

	onOpen() {
		const container = this.contentEl.createEl("div", {
			cls: "image-modal-container",
		});

		for (const imageUrl of this.imageUrls) {
			const imgWrapper = container.createEl("div", {
				cls: "image-modal-wrapper",
			});

			const img = imgWrapper.createEl("img", {
				cls: "image-modal-image",
			});
			img.src = imageUrl;

			img.addEventListener("click", async () => {
				if (this.selectedImageUrls.includes(imageUrl)) {
					this.selectedImageUrls = this.selectedImageUrls.filter(
						(url) => url !== imageUrl,
					);
					img.style.border = "none";
				} else {
					this.selectedImageUrls.push(imageUrl);
					img.style.border = "2px solid blue";
				}
				new Notice("Images copied to clipboard");
			});
		}
	}

	downloadImage = async (url: string, path: string) => {
		const response = await requestUrl({ url: url });
		await this.app.vault.adapter.writeBinary(path, response.arrayBuffer);
	};

	getImageName = (url: string) => {
		return url.split("/").pop() + ".png";
	};

	saveImagesToVault = async (imageUrls: string[], folderPath: string) => {
		for (const url of imageUrls) {
			const imageName = this.getImageName(url); // Extract the image name from the URL
			const savePath = folderPath + "/" + imageName; // Construct the save path in your vault
			await this.downloadImage(url, savePath);
		}
	};

	async onClose() {
		if (this.selectedImageUrls.length > 0) {
			if (!app.vault.getAbstractFileByPath(this.assetFolder)) {
				try {
					await app.vault.createFolder(this.assetFolder);
				} catch (error) {
					console.error("Error creating directory:", error);
				}
			}
			try {
				await this.saveImagesToVault(
					this.selectedImageUrls,
					this.assetFolder,
				);
			} catch (e) {
				new Notice("Error while downloading images");
			}
			try {
				await navigator.clipboard.writeText(
					this.selectedImageUrls
						.map((x) => `![](${this.getImageName(x)})`)
						.join("\n\n") + "\n",
				);
			} catch (e) {
				new Notice("Error while copying images to clipboard");
			}
		}
		this.contentEl.empty();
	}
}

export class SpeechModal extends Modal {
	recorder: MediaRecorder;
	gumStream: MediaStream;
	assistant: OpenAIAssistant;
	editor: Editor;
	is_cancelled: boolean;
	language: string;

	constructor(app: App, assistant: any, language: string, editor: Editor) {
		super(app);
		this.assistant = assistant;
		this.language = language;
		this.editor = editor;
		this.is_cancelled = false;
	}

	stopRecording = () => {
		this.recorder.stop();
		//stop microphone access
		if (this.gumStream) {
			this.gumStream.getAudioTracks()[0].stop();
		}
	};

	start_recording = async (
		constraints: MediaStreamConstraints,
		mimeType: string,
	) => {
		try {
			let chunks: Blob[] = [];
			this.gumStream =
				await navigator.mediaDevices.getUserMedia(constraints);

			const options = {
				audioBitsPerSecond: 256000,
				mimeType: mimeType,
			};
			this.recorder = new MediaRecorder(this.gumStream, options);

			this.recorder.ondataavailable = async (e: BlobEvent) => {
				chunks.push(e.data);
				if (this.recorder.state == "inactive" && !this.is_cancelled) {
					const audio = new File(
						chunks,
						"tmp." + mimeType.split("/").at(-1),
						{
							type: mimeType,
						},
					);
					const answer = await this.assistant.whisper_api_call(
						audio,
						this.language,
					);

					if (answer) {
						this.editor.replaceRange(
							answer,
							this.editor.getCursor(),
						);
						const newPos = {
							line: this.editor.getCursor().line,
							ch: this.editor.getCursor().ch + answer.length,
						};
						this.editor.setCursor(newPos.line, newPos.ch);
					}
					this.close();
				}
			};
			this.recorder.start(1000);
			chunks = [];
		} catch (err) {
			new Notice(err);
		}
	};

	async onOpen() {
		const { contentEl } = this;
		this.titleEl.setText("Speech to Text");

		let mimeType: string;
		if (MediaRecorder.isTypeSupported("audio/webm")) {
			mimeType = "audio/webm";
		} else {
			// Only compatible mimetype for ios
			mimeType = "video/mp4";
		}

		const constraints = { audio: true };

		const button_container = contentEl.createEl("div", {
			cls: "speech-modal-container",
		});

		const record_button = button_container.createEl("button", {
			text: "Start Recording",
			cls: "record-button",
		});

		record_button.addEventListener("click", () => {
			if (this.recorder && this.recorder.state === "recording") {
				new Notice("Stop recording");
				record_button.disabled = true;
				this.titleEl.setText("Processing record");
				this.stopRecording();
			} else {
				new Notice("Start recording");
				record_button.setText("Stop Recording");
				record_button.style.borderColor = "red";
				this.titleEl.setText("Listening...");
				this.start_recording(constraints, mimeType);
			}
		});

		const cancel_button = button_container.createEl("button", {
			text: "Cancel",
		});

		cancel_button.addEventListener("click", (e) => {
			this.is_cancelled = true;
			this.close();
		});
	}

	async onClose() {
		if (this.recorder && this.recorder.state === "recording") {
			new Notice("Stop recording");
			this.stopRecording();
		}
		this.contentEl.empty();
	}
}
