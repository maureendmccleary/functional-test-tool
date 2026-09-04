export type IconName = "add" | "back" | "close" | "edit" | "expand" | "trash";

type IconPath = {
    d: string;
    fill?: string;
    stroke?: string;
    strokeLinecap?: string;
    strokeLinejoin?: string;
    strokeWidth?: string;
};

const ICONS: Record<IconName, { paths: IconPath[] }> = {
    add: {
        paths: [
            { d: "M12 5v14M5 12h14", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "2" }
        ]
    },
    back: {
        paths: [
            { d: "M19 12H5", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "2" },
            { d: "M11 6l-6 6 6 6", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2" }
        ]
    },
    close: {
        paths: [
            { d: "M6 6l12 12", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "2" },
            { d: "M18 6L6 18", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "2" }
        ]
    },
    trash: {
        paths: [
            { d: "M4 7h16", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "2" },
            { d: "M9 7V5h6v2", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2" },
            { d: "M7 7l1 13h8l1-13", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2" },
            { d: "M10 11v5M14 11v5", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "2" }
        ]
    },
    edit: {
        paths: [
            { d: "M4 16.5V20h3.5L18.8 8.7l-3.5-3.5L4 16.5z", fill: "none", stroke: "currentColor", strokeLinejoin: "round", strokeWidth: "2" },
            { d: "M13.8 6.2l3.5 3.5", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "2" }
        ]
    },
    expand: {
        paths: [
            { d: "M9 6l6 6-6 6", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2" }
        ]
    }
};

/** Builds a decorative inline icon without relying on a downloadable font. */
export function createIcon(name: IconName): SVGSVGElement {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.classList.add("icon", `icon-${name}`);
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("focusable", "false");

    for (const pathDefinition of ICONS[name].paths) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathDefinition.d);
        for (const [attribute, value] of Object.entries(pathDefinition)) {
            if (attribute !== "d" && value !== undefined) {
                path.setAttribute(attribute.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), value);
            }
        }
        icon.appendChild(path);
    }

    return icon;
}

/** Adds the configured decorative icon to each static labelled control. */
export function decorateIconLabels(root: ParentNode = document): void {
    root.querySelectorAll<HTMLElement>('[data-icon]').forEach((control) => {
        const name = control.getAttribute('data-icon');
        if (!name || !(name in ICONS) || control.querySelector('.icon')) {
            return;
        }

        const icon = createIcon(name as IconName);
        control.classList.add('control-with-icon');
        if (control.getAttribute('data-icon-position') === 'after') {
            control.appendChild(icon);
        } else {
            control.insertBefore(icon, control.firstChild);
        }
    });
}

/** Replaces a control's visible label and optional decorative leading icon. */
export function setIconLabel(
    control: HTMLElement, label: string, iconName?: IconName
): void {
    while (control.firstChild) {
        control.removeChild(control.firstChild);
    }

    if (iconName) {
        control.appendChild(createIcon(iconName));
        control.classList.add('control-with-icon');
    } else {
        control.classList.remove('control-with-icon');
    }

    const labelText = document.createElement('span');
    labelText.textContent = label;
    control.appendChild(labelText);
}
