class I18n {
  constructor(options = {}) {
    this.defaultLanguage = options.defaultLanguage || "en";
    this.language = this.defaultLanguage;
    this.translations = {};
    this.fallbackTranslations = {};
  }

  async init(language) {
    const selectedLanguage =
      language || this.defaultLanguage;

    this.language = selectedLanguage;

    try {
      this.translations = await this.loadLanguage(
        selectedLanguage
      );
    } catch (error) {
      console.error(
        `Could not load language "${selectedLanguage}".`,
        error
      );

      this.language = this.defaultLanguage;
      this.translations = await this.loadLanguage(
        this.defaultLanguage
      );
    }

    if (this.language === this.defaultLanguage) {
      this.fallbackTranslations = this.translations;
    } else {
      try {
        this.fallbackTranslations =
          await this.loadLanguage(this.defaultLanguage);
      } catch (error) {
        console.error(
          "Could not load fallback translations.",
          error
        );

        this.fallbackTranslations = {};
      }
    }

    this.translateDocument();
  }

  async loadLanguage(language) {
    const url = chrome.runtime.getURL(
      `locales/${language}.json`
    );

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Translation file error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  getValue(source, key) {
    return key
      .split(".")
      .reduce((result, part) => {
        if (
          result !== null &&
          typeof result === "object" &&
          Object.prototype.hasOwnProperty.call(
            result,
            part
          )
        ) {
          return result[part];
        }

        return undefined;
      }, source);
  }

  t(key, variables = {}) {
    let value = this.getValue(
      this.translations,
      key
    );

    if (typeof value !== "string") {
      value = this.getValue(
        this.fallbackTranslations,
        key
      );
    }

    if (typeof value !== "string") {
      console.warn(
        `Missing translation key: ${key}`
      );

      return key;
    }

    return value.replace(
      /\{\{(\w+)\}\}/g,
      (match, variableName) => {
        if (
          Object.prototype.hasOwnProperty.call(
            variables,
            variableName
          )
        ) {
          return String(
            variables[variableName]
          );
        }

        return match;
      }
    );
  }

  translateDocument(root = document) {
    root
      .querySelectorAll("[data-i18n]")
      .forEach(element => {
        const key = element.dataset.i18n;

        element.textContent = this.t(key);
      });

    root
      .querySelectorAll(
        "[data-i18n-placeholder]"
      )
      .forEach(element => {
        const key =
          element.dataset.i18nPlaceholder;

        element.placeholder = this.t(key);
      });

    root
      .querySelectorAll("[data-i18n-title]")
      .forEach(element => {
        const key =
          element.dataset.i18nTitle;

        element.title = this.t(key);
      });

    root
      .querySelectorAll("[data-i18n-aria-label]")
      .forEach(element => {
        const key =
          element.dataset.i18nAriaLabel;

        element.setAttribute(
          "aria-label",
          this.t(key)
        );
      });

    document.documentElement.lang =
      this.language;
  }
}

const i18n = new I18n({
  defaultLanguage: "en"
});
