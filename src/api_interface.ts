// create a interface for OpenAIAssistant and GoogleGeminiApi
import { MarkdownRenderer, MarkdownView, Notice } from "obsidian";

export interface AiAssistantInterface {
    modelName: string;
	maxTokens: number;
	apiKey: string;

    display_error: (err: any) => void;

    api_call: (
        prompt_list: { [key: string]: string }[],
        htmlEl?: HTMLElement,
        view?: MarkdownView
    ) => Promise<string>;

	img_api_call: (
		model: string,
		prompt: string,
		img_size: string,
		num_img: number,
		is_hd: boolean
	) => Promise<string[]>
}

export interface AiSettingTab {
    models: Record<string, string>;
    imgModels: Record<string, string>;
}
