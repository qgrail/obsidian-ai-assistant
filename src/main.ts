import {
	App,
	Editor,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { ChatModal, ImageModal, PromptModal, SpeechModal } from "./modal";
import { AnthropicAssistant, OpenAIAssistant } from "./openai_api";
import {
	ALL_IMAGE_MODELS,
	ALL_MODELS,
	DEFAULT_IMAGE_MODEL,
	DEFAULT_OAI_IMAGE_MODEL,
	DEFAULT_MAX_TOKENS,
} from "./settings";

interface AiAssistantSettings {
	mySetting: string;
	openAIapiKey: string;
	anthropicApiKey: string;
	modelName: string;
	customModelName: string;
	imageModelName: string;
	maxTokens: number;
	replaceSelection: boolean;
	imgFolder: string;
	language: string;
	customEndpoint: string;
	useResponsesApi: boolean;
}

const DEFAULT_SETTINGS: AiAssistantSettings = {
	mySetting: "default",
	openAIapiKey: "",
	anthropicApiKey: "",
	modelName: DEFAULT_OAI_IMAGE_MODEL,
	customModelName: "",
	imageModelName: DEFAULT_IMAGE_MODEL,
	maxTokens: DEFAULT_MAX_TOKENS,
	replaceSelection: true,
	imgFolder: "AiAssistant/Assets",
	language: "",
	customEndpoint: "",
	useResponsesApi: false,
};

export default class AiAssistantPlugin extends Plugin {
	settings: AiAssistantSettings;
	aiAssistant: OpenAIAssistant;

	build_api() {
		const effectiveModel = this.settings.customModelName.trim() || this.settings.modelName;
		const customEndpoint = this.settings.customEndpoint.trim() || undefined;

		if (effectiveModel.includes("claude") && !customEndpoint) {
			this.aiAssistant = new AnthropicAssistant(
				this.settings.openAIapiKey,
				this.settings.anthropicApiKey,
				effectiveModel,
				this.settings.maxTokens,
			);
		} else {
			this.aiAssistant = new OpenAIAssistant(
				this.settings.openAIapiKey,
				effectiveModel,
				this.settings.maxTokens,
				customEndpoint,
				this.settings.useResponsesApi,
			);
		}
	}

	async onload() {
		await this.loadSettings();
		this.build_api();

		this.addCommand({
			id: "chat-mode",
			name: "Open Assistant Chat",
			callback: () => {
				new ChatModal(this.app, this.aiAssistant).open();
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
						let answer = await this.aiAssistant.text_api_call([
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
					false,
					{},
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
						const answer = await this.aiAssistant.img_api_call(
							this.settings.imageModelName,
							prompt["prompt_text"],
							prompt["img_size"],
							parseInt(prompt["num_img"]),
							prompt["is_hd"] === "true",
						);
						if (answer) {
							const imageModal = new ImageModal(
								this.app,
								answer,
								prompt["prompt_text"],
								this.settings.imgFolder,
							);
							imageModal.open();
						}
					},
					true,
					{ model: this.settings.imageModelName },
				).open();
			},
		});

		this.addCommand({
			id: "speech-to-text",
			name: "Open Speech to Text",
			editorCallback: (editor: Editor) => {
				new SpeechModal(
					this.app,
					this.aiAssistant,
					this.settings.language,
					editor,
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
			await this.loadData(),
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
			.setName("OpenAI / Custom Endpoint API Key")
			.setDesc(
				"API key for OpenAI or any custom inference endpoint. " +
				"When using a custom endpoint (e.g. NVIDIA), enter that provider's API key here.",
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter API key here")
					.setValue(this.plugin.settings.openAIapiKey)
					.onChange(async (value) => {
						this.plugin.settings.openAIapiKey = value;
						await this.plugin.saveSettings();
						this.plugin.build_api();
					}),
			);

		new Setting(containerEl)
			.setName("Anthropic API Key")
			.setDesc("API key for Anthropic (used only when no custom endpoint is set and a Claude model is selected).")
			.addText((text) =>
				text
					.setPlaceholder("Enter Anthropic key here")
					.setValue(this.plugin.settings.anthropicApiKey)
					.onChange(async (value) => {
						this.plugin.settings.anthropicApiKey = value;
						await this.plugin.saveSettings();
						this.plugin.build_api();
					}),
			);
		containerEl.createEl("h3", { text: "Custom Inference Endpoint" });

		new Setting(containerEl)
			.setName("Custom API Base URL")
			.setDesc(
				"Optional. Use an OpenAI-compatible endpoint (e.g. https://integrate.api.nvidia.com/v1). " +
				"When set, all text requests are routed through this endpoint using the OpenAI SDK.",
			)
			.addText((text) =>
				text
					.setPlaceholder("https://integrate.api.nvidia.com/v1")
					.setValue(this.plugin.settings.customEndpoint)
					.onChange(async (value) => {
						this.plugin.settings.customEndpoint = value;
						await this.plugin.saveSettings();
						this.plugin.build_api();
					}),
			);

		new Setting(containerEl)
			.setName("Custom Model Name")
			.setDesc(
				"Optional. Override the model dropdown with a custom model identifier " +
				"(e.g. nvidia/llama-3.1-nemotron-70b-instruct).",
			)
			.addText((text) =>
				text
					.setPlaceholder("nvidia/llama-3.1-nemotron-70b-instruct")
					.setValue(this.plugin.settings.customModelName)
					.onChange(async (value) => {
						this.plugin.settings.customModelName = value;
						await this.plugin.saveSettings();
						this.plugin.build_api();
					}),
			);

		new Setting(containerEl)
			.setName("Use Responses API")
			.setDesc(
				"Use the /v1/responses endpoint instead of /v1/chat/completions. " +
				"Required for some providers (e.g. NVIDIA inference-api.nvidia.com with GPT models).",
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.useResponsesApi)
					.onChange(async (value) => {
						this.plugin.settings.useResponsesApi = value;
						await this.plugin.saveSettings();
						this.plugin.build_api();
					});
			});

		containerEl.createEl("h3", { text: "Text Assistant" });

		new Setting(containerEl)
			.setName("Model Name")
			.setDesc("Select your model")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(ALL_MODELS)
					.setValue(this.plugin.settings.modelName)
					.onChange(async (value) => {
						this.plugin.settings.modelName = value;
						await this.plugin.saveSettings();
						this.plugin.build_api();
					}),
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
					}),
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
					}),
			);
		new Setting(containerEl)
			.setName("Image Model Name")
			.setDesc("Select your model")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(ALL_IMAGE_MODELS)
					.setValue(this.plugin.settings.imageModelName)
					.onChange(async (value) => {
						this.plugin.settings.imageModelName = value;
						await this.plugin.saveSettings();
						this.plugin.build_api();
					}),
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
					}),
			);

		const div = containerEl.createDiv({ cls: "coffee-container" });
		div.createEl("a", {
			href: "https://buymeacoffee.com/qgrail",
		}).createEl("img", {
			attr: {
				src: "https://cdn.buymeacoffee.com/buttons/v2/default-violet.png",
			},
			cls: "coffee-button-img",
		});
	}
}
