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
		[
			"openai", {
				apiKey: "",
				modelName: "gpt-3.5-turbo",
				imageModelName: "dall-e-3",
				maxTokens: 500,
				replaceSelection: false,
				imgFolder: "AiAssistant/Assets",
				language: "",
			}],
		[
			"google", {
				apiKey: "",
				modelName: "gemini-pro",
				imageModelName: "gemini-pro-vision",
				maxTokens: 1000,
				replaceSelection: false,
				imgFolder: "AiAssistant/Assets",
				language: "",
			}
		]
	])
};

export default class AiAssistantPlugin extends Plugin {
	settings: Settings;
	// assistantSettings: AiAssistantSettings;
	model: AiAssistantInterface;

	build_api() {
		if (!this.assistantSettings(this.settings.provider).apiKey || this.assistantSettings(this.settings.provider).apiKey === "") {
			new Notice("AI Assistant: API Key is empty");
			return;
		}
		if (!this.assistantSettings(this.settings.provider).modelName || this.assistantSettings(this.settings.provider).modelName === "") {
			new Notice("AI Assistant: Model Name is empty");
			return;
		}
		try {
			switch (this.settings.provider) {
				case "openai":
					this.model = new OpenAIAssistant(
						this.assistantSettings(this.settings.provider).apiKey,
						this.assistantSettings(this.settings.provider).modelName,
						this.assistantSettings(this.settings.provider).maxTokens,
					);
					break;
				case "google":
					this.model = new GoogleGeminiApi(
						this.assistantSettings(this.settings.provider).apiKey,
						this.assistantSettings(this.settings.provider).modelName,
						this.assistantSettings(this.settings.provider).maxTokens,
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

	assistantSettings(provider: string): AiAssistantSettings {
		return this.settings.assistantSettings.get(provider)!;
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
						if (!this.assistantSettings(this.settings.provider).replaceSelection) {
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
							this.assistantSettings(this.settings.provider).imageModelName,
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
								this.assistantSettings(this.settings.provider).imgFolder
							);
							imageModal.open();
						}
					},
					true,
					{ model: this.assistantSettings(this.settings.provider).imageModelName }
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
					this.assistantSettings(this.settings.provider).language,
					editor
				).open();
			},
		});

		this.addSettingTab(new AiAssistantSettingTab(this.app, this));
	}

	onunload() {
	}

	async loadSettings() {

		function reviver(key: string, value: any) {
			if (typeof value === 'object' && value !== null) {
				if (value.dataType === 'Map') {
					return new Map(value.value);
				}
			}
			return value;
		}

		var data = await this.loadData();
		console.log(typeof data);
		console.log(data);
		if (data) {
			this.settings = JSON.parse(data, reviver);
		} else {
			let _ = require("lodash");
			this.settings = _.cloneDeep(DEFAULT_SETTINGS);
		}

		// console.log("loadSettings:\n");
		// console.log(this.settings);
	}

	async saveSettings() {
		function replacer(key: string, value: any) {
			if (value instanceof Map) {
				return {
					dataType: 'Map',
					value: Array.from(value.entries()), // or with spread: value: [...value]
				};
			} else {
				return value;
			}
		}

		// console.log("saveSettings:\n" + JSON.stringify(this.settings, replacer));
		await this.saveData(JSON.stringify(this.settings, replacer));
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
						await this.plugin.saveSettings();

						// load the new settings
						this.plugin.settings.provider = value;

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
					.setValue(this.plugin.assistantSettings(this.plugin.settings.provider).apiKey)
					.onChange(async (value) => {
						this.plugin.assistantSettings(this.plugin.settings.provider).apiKey = value;
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
					.setValue(this.plugin.assistantSettings(this.plugin.settings.provider).modelName)
					.onChange(async (value) => {
						this.plugin.assistantSettings(this.plugin.settings.provider).modelName = value;
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
					.setValue(this.plugin.assistantSettings(this.plugin.settings.provider).maxTokens.toString())
					.onChange(async (value) => {
						const int_value = parseInt(value);
						if (!int_value || int_value <= 0) {
							new Notice("Error while parsing maxTokens ");
						} else {
							this.plugin.assistantSettings(this.plugin.settings.provider).maxTokens = int_value;
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
					.setValue(this.plugin.assistantSettings(this.plugin.settings.provider).replaceSelection)
					.onChange(async (value) => {
						this.plugin.assistantSettings(this.plugin.settings.provider).replaceSelection = value;
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
					.setValue(this.plugin.assistantSettings(this.plugin.settings.provider).imgFolder)
					.onChange(async (value) => {
						const path = value.replace(/\/+$/, "");
						if (path) {
							this.plugin.assistantSettings(this.plugin.settings.provider).imgFolder = path;
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
					.setValue(this.plugin.assistantSettings(this.plugin.settings.provider).imageModelName)
					.onChange(async (value) => {
						this.plugin.assistantSettings(this.plugin.settings.provider).imageModelName = value;
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
					.setValue(this.plugin.assistantSettings(this.plugin.settings.provider).language)
					.onChange(async (value) => {
						this.plugin.assistantSettings(this.plugin.settings.provider).language = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
