import {
	App,
	Modal,
	Notice,
	requestUrl,
	Setting,
	MarkdownRenderer,
	MarkdownView,
	Editor,
} from "obsidian";

export class PromptModal extends Modal {
	param_dict: { [key: string]: string };
	onSubmit: (input_dict: object) => void;
	is_img_modal: boolean;

	constructor(
		app: App,
		onSubmit: (x: object) => void,
		is_img_modal: boolean
	) {
		super(app);
		this.onSubmit = onSubmit;
		this.is_img_modal = is_img_modal;
		this.param_dict = { img_size: "256x256", num_img: "1" };
	}

	onOpen() {
		const { contentEl } = this;
		if (this.is_img_modal) {
			this.titleEl.setText("What can I generate for you?");
		} else {
			this.titleEl.setText("What can I do for you?");
		}

		const prompt_area = new Setting(contentEl).addText((text) =>
			text.onChange((value) => {
				this.param_dict["prompt_text"] = value.trim();
			})
		);

		prompt_area.addButton((btn) =>
			btn
				.setButtonText("Submit")
				.setCta()
				.onClick(() => {
					if (this.param_dict["prompt_text"]) {
						this.close();
						this.onSubmit(this.param_dict);
					}
				})
		);

		const input_prompt = this.modalEl.getElementsByTagName("input")[0];
		input_prompt.addEventListener("keypress", (evt) => {
			if (evt.key === "Enter" && this.param_dict["prompt_text"]) {
				this.close();
				this.onSubmit(this.param_dict);
			}
		});

		if (this.is_img_modal) {
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

			const desc2 = prompt_left_container.createEl("p", {
				cls: "description",
			});
			desc2.innerText = "Num images";

			const prompt_right_container = prompt_container.createEl("div", {
				cls: "prompt-right-container",
			});

			const resolution_dropdown =
				prompt_right_container.createEl("select");
			const options = ["256x256", "512x512", "1024x1024"];
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

			const num_img_dropdown = prompt_right_container.createEl("select");
			const num_choices = [...Array(10).keys()].map((x) =>
				(x + 1).toString()
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
	}

	onClose() {
		this.contentEl.empty();
	}
}

export class ChatModal extends Modal {
	prompt_text: string;
	prompt_table: { [key: string]: string }[] = [];
	openai: any;
	is_generating_answer: boolean;

	constructor(app: App, openai: any) {
		super(app);
		this.openai = openai;
		this.is_generating_answer = false;
	}

	clearModalContent() {
		this.contentEl.innerHTML = "";
		this.prompt_text = "";
	}

	send_action = async () => {
		if (this.prompt_text && !this.is_generating_answer) {
			this.is_generating_answer = true;
			const prompt = {
				role: "user",
				content: this.prompt_text,
			};

			this.prompt_table.push(prompt, {
				role: "assistant",
				content: "Generating answer...",
			});

			this.clearModalContent();
			await this.displayModalContent();

			this.prompt_table.pop();
			const answer = await this.openai.api_call(this.prompt_table);
			if (answer) {
				this.prompt_table.push({
					role: "assistant",
					content: answer,
				});
			}

			this.clearModalContent();
			await this.displayModalContent();
			this.is_generating_answer = false;
		}
	};

	async displayModalContent() {
		const { contentEl } = this;
		const container = this.contentEl.createEl("div", {
			cls: "chat-modal-container",
		});
		const view = this.app.workspace.getActiveViewOfType(
			MarkdownView
		) as MarkdownView;

		for (const x of this.prompt_table) {
			const div = container.createEl("div", {
				cls: `chat-div ${x["role"]}`,
			});
			if (x["role"] === "assistant") {
				await MarkdownRenderer.renderMarkdown(
					x["content"],
					div,
					"",
					view
				);
			} else {
				div.createEl("p", {
					text: x["content"],
				});
			}
			div.addEventListener("click", async () => {
				await navigator.clipboard.writeText(x["content"]);
				new Notice(x["content"] + " Copied to clipboard!");
			});
		}

		const prompt_field = new Setting(contentEl)
			.setName("Type here:")
			.addText((text) => {
				text.setPlaceholder("Your prompt here").onChange((value) => {
					this.prompt_text = value.trim();
				});
			});

		const input_prompt = this.modalEl.getElementsByTagName("input")[0];
		input_prompt.focus();
		input_prompt.select();

		input_prompt.addEventListener("keypress", (evt) => {
			if (evt.key === "Enter") {
				this.send_action();
			}
		});

		prompt_field.addButton((btn) =>
			btn
				.setButtonText("Submit")
				.setCta()
				.onClick(() => this.send_action())
		);

		const clear_button = new Setting(contentEl).addButton((btn) =>
			btn.setButtonText("Clear").onClick(() => {
				this.prompt_table = [];
				this.clearModalContent();
				this.displayModalContent();
			})
		);

		clear_button.addButton((btn) =>
			btn.setButtonText("Copy conversation").onClick(async () => {
				const conversation = this.prompt_table
					.map((x) => x["content"])
					.join("\n\n");
				await navigator.clipboard.writeText(conversation);
				new Notice("Conversation copied to clipboard");
			})
		);
	}

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
		assetFolder: string
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
						(url) => url !== imageUrl
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
					this.assetFolder
				);
			} catch (e) {
				new Notice("Error while downloading images");
			}
			try {
				await navigator.clipboard.writeText(
					this.selectedImageUrls
						.map((x) => `![](${this.getImageName(x)})`)
						.join("\n\n") + "\n"
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
	openai: any;
	editor: Editor;
	is_cancelled: boolean;
	language: string;

	constructor(app: App, openai: any, language: string, editor: Editor) {
		super(app);
		this.openai = openai;
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
		extension: string
	) => {
		try {
			let chunks: Blob[] = [];
			this.gumStream = await navigator.mediaDevices.getUserMedia(
				constraints
			);

			const options = {
				audioBitsPerSecond: 256000,
				mimeType: "audio/" + extension + ";codecs=opus",
			};
			this.recorder = new MediaRecorder(this.gumStream, options);

			this.recorder.ondataavailable = async (e: BlobEvent) => {
				chunks.push(e.data);
				if (this.recorder.state == "inactive" && !this.is_cancelled) {
					const audio = new File(chunks, "tmp." + extension, {
						type: "audio/" + extension,
					});
					const answer = await this.openai.whisper_api_call(
						audio,
						this.language
					);

					if (answer) {
						this.editor.replaceRange(
							answer,
							this.editor.getCursor()
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

		let extension: string;
		if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
			extension = "webm";
		} else {
			extension = "ogg";
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
				this.start_recording(constraints, extension);
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
