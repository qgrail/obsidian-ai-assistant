import {
	App,
	Editor,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { ChatModal, ImageModal, PromptModal, SpeechModal } from "./modal";
import { OpenAI } from "./openai_api";

interface AiAssistantSettings {
	mySetting: string;
	apiKey: string;
	modelName: string;
	maxTokens: number;
	replaceSelection: boolean;
	imgFolder: string;
	language: string;
}

const DEFAULT_SETTINGS: AiAssistantSettings = {
	mySetting: "default",
	apiKey: "",
	modelName: "gpt-3.5-turbo",
	maxTokens: 500,
	replaceSelection: true,
	imgFolder: "AiAssistant/Assets",
	language: "",
};

export default class AiAssistantPlugin extends Plugin {
	settings: AiAssistantSettings;
	openai: OpenAI;

	build_api() {
		this.openai = new OpenAI(
			this.settings.apiKey,
			this.settings.modelName,
			this.settings.maxTokens
		);
	}

	async onload() {
		await this.loadSettings();
		this.build_api();

		this.addCommand({
			id: "chat-mode",
			name: "Open Assistant Chat",
			callback: () => {
				new ChatModal(this.app, this.openai).open();
			},
		});

		this.addCommand({
			id: "prompt-mode",
			name: "Open Assistant Prompt",
			editorCallback: async (editor: Editor) => {
				const selected_text = editor.getSelection().toString().trim();
				new PromptModal(
					this.app,
					async (x: { [key: string]: string }) => {
						let answer = await this.openai.api_call([
							{
								role: "user",
								content:
									x["prompt_text"] + " : " + selected_text,
							},
						]);
						answer = answer!;
						if (!this.settings.replaceSelection) {
							answer = selected_text + "\n" + answer.trim();
						}
						if (answer) {
							editor.replaceSelection(answer.trim());
						}
					},
					false
				).open();
			},
		});

		this.addCommand({
			id: "img-generator",
			name: "Open Image Generator",
			editorCallback: async (editor: Editor) => {
				new PromptModal(
					this.app,
					async (prompt: { [key: string]: string }) => {
						const answer = await this.openai.img_api_call(
							prompt["prompt_text"],
							prompt["img_size"],
							parseInt(prompt["num_img"])
						);
						if (answer) {
							const imageModal = new ImageModal(
								this.app,
								answer,
								prompt["prompt_text"],
								this.settings.imgFolder
							);
							imageModal.open();
						}
					},
					true
				).open();
			},
		});

		this.addCommand({
			id: "speech-to-text",
			name: "Open Speech to Text",
			editorCallback: (editor: Editor) => {
				new SpeechModal(
					this.app,
					this.openai,
					this.settings.language,
					editor
				).open();
			},
		});

		this.addSettingTab(new AiAssistantSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class AiAssistantSettingTab extends PluginSettingTab {
	plugin: AiAssistantPlugin;

	constructor(app: App, plugin: AiAssistantPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl("h2", { text: "Settings for my AI assistant." });

		new Setting(containerEl)
			.setName("API Key")
			.setDesc("OpenAI API Key")
			.addText((text) =>
				text
					.setPlaceholder("Enter your key here")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
						this.plugin.build_api();
					})
			);
		containerEl.createEl("h3", { text: "Text Assistant" });

		new Setting(containerEl)
			.setName("Model Name")
			.setDesc("Select your model")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						"gpt-3.5-turbo": "gpt-3.5-turbo",
						"gpt-4": "gpt-4",
					})
					.setValue(this.plugin.settings.modelName)
					.onChange(async (value) => {
						this.plugin.settings.modelName = value;
						await this.plugin.saveSettings();
						this.plugin.build_api();
					})
			);

		new Setting(containerEl)
			.setName("Max Tokens")
			.setDesc("Select max number of generated tokens")
			.addText((text) =>
				text
					.setPlaceholder("Max tokens")
					.setValue(this.plugin.settings.maxTokens.toString())
					.onChange(async (value) => {
						const int_value = parseInt(value);
						if (!int_value || int_value <= 0) {
							new Notice("Error while parsing maxTokens ");
						} else {
							this.plugin.settings.maxTokens = int_value;
							await this.plugin.saveSettings();
							this.plugin.build_api();
						}
					})
			);

		new Setting(containerEl)
			.setName("Prompt behavior")
			.setDesc("Replace selection")
			.addToggle((toogle) => {
				toogle
					.setValue(this.plugin.settings.replaceSelection)
					.onChange(async (value) => {
						this.plugin.settings.replaceSelection = value;
						await this.plugin.saveSettings();
						this.plugin.build_api();
					});
			});
		containerEl.createEl("h3", { text: "Image Assistant" });
		new Setting(containerEl)
			.setName("Default location for generated images")
			.setDesc("Where generated images are stored.")
			.addText((text) =>
				text
					.setPlaceholder("Enter the path to you image folder")
					.setValue(this.plugin.settings.imgFolder)
					.onChange(async (value) => {
						const path = value.replace(/\/+$/, "");
						if (path) {
							this.plugin.settings.imgFolder = path;
							await this.plugin.saveSettings();
						} else {
							new Notice("Image folder cannot be empty");
						}
					})
			);

		containerEl.createEl("h3", { text: "Speech to Text" });
		new Setting(containerEl)
			.setName("The language of the input audio")
			.setDesc("Using ISO-639-1 format (en, fr, de, ...)")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.language)
					.onChange(async (value) => {
						this.plugin.settings.language = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
