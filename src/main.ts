import {
	App,
	Editor,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { ChatModal, ImageModal, PromptModal, SpeechModal } from "./modal";
import { AiAssistantInterface, AiSettingTab } from "./api_interface";
import { OpenAIAssistant, OpenaiSettingTab } from "./openai_api";
import { GoogleGeminiApi, GoogleGeminiSettingTab } from "./google_gemini_api";
import { type } from "os";

interface Settings {
	provider: string;
	assistantSettings: Map<string, AiAssistantSettings>;
};

interface AiAssistantSettings {
	apiKey: string;
	modelName: string;
	imageModelName: string;
	maxTokens: number;
	replaceSelection: boolean;
	imgFolder: string;
	language: string;
}
const DEFAULT_SETTINGS: Settings = {
	provider: "openai",
	assistantSettings: new Map<string, AiAssistantSettings>([
		["openai", {
			apiKey: "",
			modelName: "gpt-3.5-turbo",
			imageModelName: "dall-e-3",
			maxTokens: 500,
			replaceSelection: true,
			imgFolder: "AiAssistant/Assets",
			language: "",
		}],
		[
			"google", {
				apiKey: "",
				modelName: "gemini-pro-vision",
				imageModelName: "none",
				maxTokens: 100,
				replaceSelection: true,
				imgFolder: "AiAssistant/Assets",
				language: "",
			}
		]
	])
};

export default class AiAssistantPlugin extends Plugin {
	settings: Settings;
	assistantSettings: AiAssistantSettings;
	model: AiAssistantInterface;

	build_api() {
		try {
			switch (this.settings.provider) {
				case "openai":
					this.model = new OpenAIAssistant(
						this.assistantSettings.apiKey,
						this.assistantSettings.modelName,
						this.assistantSettings.maxTokens,
					);
					break;
				case "google":
					this.model = new GoogleGeminiApi(
						this.assistantSettings.apiKey,
						this.assistantSettings.modelName,
						this.assistantSettings.maxTokens,
					);
					break;
				default:
					new Notice("Provider not supported");
					break;
			}
		} catch (error) {
			new Notice("Error while building API. Please check your settings." + error);
		}
	}

	async onload() {
		await this.loadSettings();
		this.build_api();

		this.addCommand({
			id: "chat-mode",
			name: "Open Assistant Chat",
			callback: () => {
				new ChatModal(this.app, this.model).open();
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
						let answer = await this.model.api_call([
							{
								role: "user",
								content:
									x["prompt_text"] + " : " + selected_text,
							},
						]);
						answer = answer!;
						if (!this.assistantSettings.replaceSelection) {
							answer = selected_text + "\n" + answer.trim();
						}
						if (answer) {
							editor.replaceSelection(answer.trim());
						}
					},
					false,
					{}
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
						const answer = await this.model.img_api_call(
							this.assistantSettings.imageModelName,
							prompt["prompt_text"],
							prompt["img_size"],
							parseInt(prompt["num_img"]),
							prompt["is_hd"] === "true"
						);
						if (answer) {
							const imageModal = new ImageModal(
								this.app,
								answer,
								prompt["prompt_text"],
								this.assistantSettings.imgFolder
							);
							imageModal.open();
						}
					},
					true,
					{ model: this.assistantSettings.imageModelName }
				).open();
			},
		});

		this.addCommand({
			id: "speech-to-text",
			name: "Open Speech to Text",
			editorCallback: (editor: Editor) => {
				new SpeechModal(
					this.app,
					this.model,
					this.assistantSettings.language,
					editor
				).open();
			},
		});

		this.addSettingTab(new AiAssistantSettingTab(this.app, this));
	}

	onunload() {
		this.saveSettings();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		// convert this.settings.assistantSettings to Map<string, AiAssistantSettings>
		this.settings.assistantSettings = new Map<string, AiAssistantSettings>(Object.entries(this.settings.assistantSettings));
		try {
			this.assistantSettings = this.settings.assistantSettings.get(this.settings.provider)!;
			if (!this.assistantSettings) {
				throw new Error("Error while loading settings");
			}
		} catch (error) {
			this.settings.provider = "openai";
			this.assistantSettings = DEFAULT_SETTINGS.assistantSettings.get("openai")!;
		}

		console.log("loadSettings:\n" + this.settings);
	}

	async saveSettings() {
		console.log("saveSettings:\n" + this.settings);
		await this.saveData(this.settings);
	}
}

class AiAssistantSettingTab extends PluginSettingTab {
	plugin: AiAssistantPlugin;
	setting_tab: AiSettingTab;

	constructor(app: App, plugin: AiAssistantPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		switch (this.plugin.settings.provider) {
			case "openai":
				this.setting_tab = OpenaiSettingTab;
				break;
			case "google":
				this.setting_tab = GoogleGeminiSettingTab;
				break;
			default:
				new Notice("Provider not supported");
				break;
		}
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl("h2", { text: "Settings for my AI assistant." });

		new Setting(containerEl).
			setName("Provider").
			setDesc("Select your provider").
			addDropdown((dropdown) =>
				dropdown
					.addOptions({
						"openai": "OpenAI",
						"google": "Google",
					})
					.setValue(this.plugin.settings.provider)
					.onChange(async (value) => {
						// save the current settings
						this.plugin.settings.assistantSettings.set(this.plugin.settings.provider, this.plugin.assistantSettings);
						await this.plugin.saveSettings();

						// load the new settings
						this.plugin.settings.provider = value;
						this.plugin.assistantSettings = this.plugin.settings.assistantSettings.get(value)!;
						if (!this.plugin.assistantSettings) {
							this.plugin.assistantSettings = DEFAULT_SETTINGS.assistantSettings.get(value)!;
						}

						// console.log(this.plugin.assistantSettings);

						switch (value) {
							case "openai":
								this.setting_tab = OpenaiSettingTab;
								break;
							case "google":
								this.setting_tab = GoogleGeminiSettingTab;
								break;
							default:
								new Notice("Provider not supported");
								break;
						}

						// console.log(this.setting_tab);

						this.plugin.build_api();
						// fresh the setting tab
						this.display();
					})
			);

		new Setting(containerEl)
			.setName("API Key")
			.setDesc("API Key")
			.addText((text) =>
				text
					.setPlaceholder("Enter your key here")
					.setValue(this.plugin.assistantSettings.apiKey)
					.onChange(async (value) => {
						this.plugin.assistantSettings.apiKey = value;
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
					.addOptions(this.setting_tab.models)
					.setValue(this.plugin.assistantSettings.modelName)
					.onChange(async (value) => {
						this.plugin.assistantSettings.modelName = value;
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
					.setValue(this.plugin.assistantSettings.maxTokens.toString())
					.onChange(async (value) => {
						const int_value = parseInt(value);
						if (!int_value || int_value <= 0) {
							new Notice("Error while parsing maxTokens ");
						} else {
							this.plugin.assistantSettings.maxTokens = int_value;
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
					.setValue(this.plugin.assistantSettings.replaceSelection)
					.onChange(async (value) => {
						this.plugin.assistantSettings.replaceSelection = value;
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
					.setValue(this.plugin.assistantSettings.imgFolder)
					.onChange(async (value) => {
						const path = value.replace(/\/+$/, "");
						if (path) {
							this.plugin.assistantSettings.imgFolder = path;
							await this.plugin.saveSettings();
						} else {
							new Notice("Image folder cannot be empty");
						}
					})
			);
		new Setting(containerEl)
			.setName("Image Model Name")
			.setDesc("Select your model")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(this.setting_tab.imgModels)
					.setValue(this.plugin.assistantSettings.imageModelName)
					.onChange(async (value) => {
						this.plugin.assistantSettings.imageModelName = value;
						await this.plugin.saveSettings();
						this.plugin.build_api();
					})
			);

		containerEl.createEl("h3", { text: "Speech to Text" });
		new Setting(containerEl)
			.setName("The language of the input audio")
			.setDesc("Using ISO-639-1 format (en, zh, fr, de, ...)")
			.addText((text) =>
				text
					.setValue(this.plugin.assistantSettings.language)
					.onChange(async (value) => {
						this.plugin.assistantSettings.language = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
