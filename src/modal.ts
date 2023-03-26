import { App, Modal, Notice, Setting } from "obsidian";

const ROLES = ["user", "assistant"];

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
		this.param_dict = { img_size: "256x256" };
	}

	onOpen() {
		let { contentEl } = this;
		this.titleEl.setText("What can I do for you?");
		const prompt_area = new Setting(contentEl).addText((text) =>
			text.onChange((value) => {
				this.param_dict["prompt_text"] = value.trim();
			})
		);

		const submit_btn = prompt_area.addButton((btn) =>
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

		if (this.is_img_modal)
			submit_btn.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						"256x256": "256x256",
						"512x512": "512x512",
						"1024x1024": "1024x1024",
					})
					.setValue(this.param_dict["img_size"])
					.onChange(async (value) => {
						this.param_dict["img_size"] = value;
					})
			);

		const input_prompt = this.modalEl.getElementsByTagName("input")[0];
		input_prompt.addEventListener("keypress", (evt) => {
			if (evt.key === "Enter" && this.param_dict["prompt_text"]) {
				this.close();
				this.onSubmit(this.param_dict);
			}
		});
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}

export class ChatModal extends Modal {
	prompt_text: string;
	prompt_table: { [key: string]: string }[] = [];
	openai: any;

	constructor(app: App, openai: any) {
		super(app);
		this.openai = openai;
	}

	clearModalContent() {
		this.contentEl.innerHTML = "";
		this.prompt_text = "";
	}

	send_action = async () => {
		if (this.prompt_text) {
			const prompt = {
				role: "user",
				content: this.prompt_text,
			};

			const answer = await this.openai.api_call(
				this.prompt_table.concat(prompt)
			);
			if (answer) {
				this.prompt_table.push(prompt, {
					role: "assistant",
					content: answer,
				});
			}

			this.clearModalContent();
			this.displayModalContent();
		}
	};

	displayModalContent() {
		let { contentEl } = this;
		const book = contentEl.createEl("div");

		this.prompt_table.forEach((x) => {
			book.createEl("p", {
				text: x["content"],
				cls: x["role"],
			});
		});

		const prompt_field = new Setting(contentEl)
			.setName("Type here:")
			.setClass("user")
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
			btn
				.setButtonText("Clear")
				.setCta()
				.onClick(() => {
					this.prompt_table = [];
					this.clearModalContent();
					this.displayModalContent();
				})
		);

		clear_button.addButton((btn) =>
			btn
				.setButtonText("Copy conversation")
				.setCta()
				.onClick(async () => {
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
		this.modalEl.addEventListener("click", async (event) => {
			const target = event.target as HTMLElement;
			if (
				target &&
				target.textContent &&
				ROLES.includes(target.className)
			) {
				await navigator.clipboard.writeText(target.textContent.trim());
				new Notice(target.textContent.trim() + " Copied to clipboard!");
			}
		});
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}
