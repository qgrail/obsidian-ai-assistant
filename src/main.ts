import {
	App,
	Editor,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	Vault,
} from "obsidian";
import { ChatModal, ImageModal, PromptModal, SpeechModal } from "./modal";
import { OpenAIAssistant, AnthropicAssistant } from "./openai_api";

interface AiAssistantSettings {
	mySetting: string;
	openAIapiKey: string;
	anthropicApiKey: string;
	modelName: string;
	imageModelName: string;
	fileNameWithSystemPromptForAI: string;
	temperature: number;
	maxTokens: number;
	replaceSelection: boolean;
	imgFolder: string;
	language: string;
}

const DEFAULT_SETTINGS: AiAssistantSettings = {
	mySetting: "default",
	openAIapiKey: "",
	anthropicApiKey: "",
	modelName: "gpt-3.5-turbo",
	imageModelName: "dall-e-3",
	fileNameWithSystemPromptForAI: "System Prompt for AI.md",
	maxTokens: 500,
	temperature: 0.5,
	replaceSelection: true,
	imgFolder: "AiAssistant/Assets",
	language: "",
};

export default class AiAssistantPlugin extends Plugin {
	settings: AiAssistantSettings;
	aiAssistant: OpenAIAssistant;

	build_api() {
		if (this.settings.modelName.includes("claude")) {
			this.aiAssistant = new AnthropicAssistant(
				this.settings.openAIapiKey,
				this.settings.anthropicApiKey,
				this.settings.modelName,
				this.settings.maxTokens,
			);
		} else {
			this.aiAssistant = new OpenAIAssistant(
				this.settings.openAIapiKey,
				this.settings.modelName,
				this.settings.maxTokens,
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
			id: "rewrite",
			name: "Open Assistant Rewrite",
			editorCallback: async (editor: Editor) => {
				const fileName = this.settings.fileNameWithSystemPromptForAI; // replace with your specific file name
				const files = this.app.vault.getFiles();
				
				// Find the file with the specified name
				const file = files.find(f => f.name === fileName);
				
				if (!file) {
				   console.error(`File '${fileName}' not found.`);
				   return;
				}
				
				// Read the content of the specific file
				let systemPromptText = await this.app.vault.read(file);

				// Get the complete text of the current note
				const completeText = editor.getValue().trim();

				// Replace the placeholder with the complete text of the note
				systemPromptText = systemPromptText.replace("{NODE TEXT}", completeText);


				//console.debug (systemPromptText);

				const selected_text = editor.getSelection().toString().trim();

				const userPrompt = "improve: \n" + selected_text;

				//console.debug (userPrompt);

				let answer = await this.aiAssistant.text_api_call([
					{
						role: "system",
						content: systemPromptText,
					},						
					{
						role: "user",
						content: userPrompt,
					},
				],undefined,undefined, this.settings.temperature);
				answer = answer!;
				if (!this.settings.replaceSelection) {
					answer = selected_text + "\n" + answer.trim();
				}
				if (answer) {
					editor.replaceSelection(answer.trim());
				}
			},
		});

		this.addCommand({
			id: "prompt-mode",
			name: "Open Assistant Promt",
			editorCallback: async (editor: Editor) => {

				const fileName = this.settings.fileNameWithSystemPromptForAI;
				const files = this.app.vault.getFiles();
				
				// Find the file with the specified name
				const file = files.find(f => f.name === fileName);
				
				if (!file) {
				   console.error(`File '${fileName}' not found.`);
				   return;
				}
				
				// Read the content of the specific file
				let systemPromptText = await this.app.vault.read(file);

				// Get the complete text of the current note
				const completeText = editor.getValue().trim();

				// Replace the placeholder with the complete text of the note
				systemPromptText = systemPromptText.replace("{NODE TEXT}", completeText);


				//console.debug (systemPromptText);

				const selected_text = editor.getSelection().toString().trim();


				new PromptModal(
					this.app,
					async (x: { [key: string]: string }) => {
						const userPrompt = x["prompt_text"] + ": \n" + selected_text;

						//console.debug (userPrompt);

						let answer = await this.aiAssistant.text_api_call([					
							{
								role: "system",
								content: systemPromptText,
							},						
							{
								role: "user",
								content: userPrompt,
							},
						],undefined,undefined, this.settings.temperature);
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

		new Setting(containerEl).setName("OpenAI API Key").addText((text) =>
			text
				.setPlaceholder("Enter OpenAI key here")
				.setValue(this.plugin.settings.openAIapiKey)
				.onChange(async (value) => {
					this.plugin.settings.openAIapiKey = value;
					await this.plugin.saveSettings();
					this.plugin.build_api();
				}),
		);

		new Setting(containerEl).setName("Anthropic API Key").addText((text) =>
			text
				.setPlaceholder("Enter Anthropic key here")
				.setValue(this.plugin.settings.anthropicApiKey)
				.onChange(async (value) => {
					this.plugin.settings.anthropicApiKey = value;
					await this.plugin.saveSettings();
					this.plugin.build_api();
				}),
		);
		containerEl.createEl("h3", { text: "Text Assistant" });

		new Setting(containerEl)
			.setName("Model Name")
			.setDesc("Select your model")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						"gpt-4": "gpt-4",
						"gpt-4-turbo-preview": "gpt-4-turbo",
						"gpt-3.5-turbo": "gpt-3.5-turbo",
						"claude-3-opus-20240229": "Claude 3 Opus",
						"claude-3-sonnet-20240229": "Claude 3 Sonnet",
						"claude-3-haiku-20240307": "Claude 3 Haiku",
					})
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
			.setName("File with AI System Prompt")
			.setDesc("The system prompt for configuring the AI model can be defined in a node. To give the model more context, you can add the content of the node you are currently editing with {NODE TEXT} in the system prompt.")
			.addText((text) =>
			text
				.setPlaceholder("File Name")
				.setValue(this.plugin.settings.fileNameWithSystemPromptForAI)
				.onChange(async (value) => {
					this.plugin.settings.fileNameWithSystemPromptForAI = value;
					await this.plugin.saveSettings();
					this.plugin.build_api();
				}),
		);

		new Setting(containerEl)
			.setName("Temperature")
			.setDesc("Set the creativity level, between 0 (more focused) and 1 (most creative)")
			.addSlider((slider) => {
				slider
					.setLimits(0, 1, 0.01)
					.setValue(this.plugin.settings.temperature)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.temperature = value;
						await this.plugin.saveSettings();
						this.plugin.build_api();
					});
		});



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
					.addOptions({
						"dall-e-3": "dall-e-3",
						"dall-e-2": "dall-e-2",
					})
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
	}
}
