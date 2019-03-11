import { until } from "lit-html/directives/until.js";
import { Field } from "@padloc/core/lib/item.js";
import { localize as $l } from "@padloc/core/lib/locale.js";
import { AttachmentInfo } from "@padloc/core/lib/attachment.js";
// import { ErrorCode } from "@padloc/core/lib/error.js";
// import { Listener } from "@padloc/core/lib/event-target.js";
import { formatDateFromNow } from "../util.js";
import { mixins } from "../styles";
import { confirm, dialog } from "../dialog.js";
import { app, router } from "../init.js";
import { setClipboard } from "../clipboard.js";
import { element, html, property, query, queryAll, listen } from "./base.js";
import { Dialog } from "./dialog.js";
import "./icon.js";
import { Input } from "./input.js";
import { TagsInput } from "./tags-input.js";
import { MoveItemsDialog } from "./move-items-dialog.js";
import { FieldElement } from "./field.js";
import "./field.js";
import { AttachmentElement } from "./attachment.js";
import { Generator } from "./generator.js";
import "./attachment.js";

@element("pl-item-dialog")
export class ItemDialog extends Dialog<string, void> {
    @property()
    itemId: string = "";

    get _item() {
        const found = (this.itemId && app.getItem(this.itemId)) || null;
        return found && found.item;
    }

    get _vault() {
        const found = (this.itemId && app.getItem(this.itemId)) || null;
        return found && found.vault;
    }

    @property({ reflect: true, attribute: "editing" })
    private _editing: Boolean = false;

    @property()
    private _fields: Field[] = [];

    @query("#nameInput")
    private _nameInput: Input;
    @query("pl-tags-input")
    private _tagsInput: TagsInput;
    @queryAll("pl-field")
    private _fieldInputs: FieldElement[];
    @query("input[type='file']")
    private _fileInput: HTMLInputElement;
    @queryAll("pl-attachment")
    private _attachmentElements: AttachmentElement[];

    @dialog("pl-move-items-dialog")
    private _moveItemsDialog: MoveItemsDialog;

    @dialog("pl-generator")
    private _generator: Generator;

    async show(itemId: string) {
        this._editing = false;
        this.itemId = itemId;
        await this.updateComplete;
        this._itemChanged();
        return super.show();
    }

    @listen("item-changed", app)
    @listen("vault-changed", app)
    @listen("lock", app)
    @listen("unlock", app)
    _refresh() {
        this.requestUpdate();
    }

    renderContent() {
        if (app.locked || !this._item || !this._vault) {
            return html``;
        }

        const { updated, updatedBy } = this._item!;
        const vault = this._vault!;
        const org = vault.org && app.getOrg(vault.org.id);
        const readonly = !app.hasWritePermissions(vault);
        const updatedByMember = org && org.getMember({ id: updatedBy });
        const attachments = this._item!.attachments || [];

        return html`
            <style>

                :host {
                    ${mixins.scroll()}
                }

                .inner {
                    max-width: 400px;
                    background: var(--color-quaternary);
                }

                header {
                    display: block;
                }

                .header-inner {
                    display: flex;
                }

                pl-input.name {
                    padding: 0 10px;
                }

                pl-tags-input {
                    margin: 5px 5px -5px 5px;
                }

                :host(:not([editing])) pl-field:hover {
                    background: #eee;
                }

                .add-button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 6px;
                }

                .add-button pl-icon {
                    width: 30px;
                    position: relative;
                    top: 1px;
                }

                .updated {
                    text-align: center;
                    font-size: var(--font-size-tiny);
                    color: #888;
                    background: rgba(255, 255, 255, 0.5);
                    position: absolute;
                    left: 10px;
                    bottom: 10px;
                }

                .updated::before {
                    font-family: FontAwesome;
                    font-size: 80%;
                    content: "\\f303\ ";
                }

                h4 {
                    font-size: var(--font-size-tiny);
                    color: var(--color-primary);
                    font-weight: bold;
                    margin: 10px;
                }

                .fabs {
                    position: static;
                }
            </style>

            <header>
                <div class="header-inner">
                    <pl-input
                        id="nameInput"
                        class="name flex"
                        .placeholder=${$l("Enter Item Name")}
                        ?readonly=${!this._editing}
                    >
                    </pl-input>
                    <pl-icon icon="cancel" class="tap" @click=${this.dismiss}></pl-icon>
                </div>

                <pl-tags-input .editing=${this._editing} .vault=${this._vault} @move=${this._move}></pl-tags-input>
            </header>

            <div class="fields">
                ${this._fields.map(
                    (field: Field, index: number) => html`
                        <pl-field
                            class="item"
                            .name=${field.name}
                            .value=${field.value}
                            .type=${field.type}
                            .editing=${this._editing}
                            @edit=${() => this._editField(index)}
                            @copy=${() => setClipboard(this._item!, field)}
                            @remove=${() => this._removeField(index)}
                            @generate=${() => this._generateValue(index)}
                        >
                        </pl-field>
                    `
                )}

                <div class="add-button tap item" ?hidden=${!this._editing} @click=${() => this._addField()}>
                    <pl-icon icon="add"></pl-icon>
                    <div>${$l("Add Field")}</div>
                </div>
            </div>

            <div class="attachments" ?hidden=${!attachments.length}>
                <h4>${$l("Attachments")}</h4>

                ${attachments.map(
                    a => html`
                        <pl-attachment .info=${a} .editing=${this._editing} @delete=${() => this._deleteAttachment(a)}>
                        </pl-attachment>
                    `
                )}
            </div>

            <div class="updated" hidden>
                ${until(formatDateFromNow(updated!))} ${updatedByMember && " " + $l("by {0}", updatedByMember.email)}
            </div>

            <div class="actions" ?hidden=${!this._editing}>
                <button class="primary tap" @click=${this.save}>${$l("Save")}</button>

                <button class="tap" @click=${this.cancelEdit}>${$l("Cancel")}</button>
            </div>

            <div class="fabs" ?hidden=${this._editing}>
                <pl-icon
                    icon="delete"
                    class="destructive fab tap"
                    @click=${() => this._deleteItem()}
                    ?disabled=${readonly}
                >
                </pl-icon>

                <div class="flex"></div>

                <pl-icon icon="attachment" class="fab tap" @click=${() => this._addAttachment()} ?disabled=${readonly}>
                </pl-icon>

                <pl-icon icon="edit" class="tap fab" @click=${() => this.edit()} ?disabled=${readonly}> </pl-icon>
            </div>

            <input type="file" hidden @change=${this._attachFile} />
        `;
    }

    async edit() {
        if (!app.hasWritePermissions(this._vault!)) {
            return;
        }
        this._editing = true;
        await this.updateComplete;
        this._nameInput.focus();
    }

    async cancelEdit() {
        this._fields = this._getFields();
        await this.updateComplete;
        this._editing = false;
        this._itemChanged();
    }

    save() {
        // update attachment names
        for (const [i, att] of this._item!.attachments.entries()) {
            const el = this._attachmentElements[i];
            if (el && el.attachmentName) {
                att.name = el.attachmentName;
            }
        }

        app.updateItem(this._vault!, this._item!, {
            name: this._nameInput.value,
            fields: this._getFields(),
            tags: this._tagsInput.tags
        });
        this._editing = false;
    }

    private _getFields() {
        return [...this._fieldInputs].map((fieldEl: FieldElement) => {
            return {
                name: fieldEl.name,
                value: fieldEl.value,
                type: fieldEl.type
            };
        });
    }

    private _itemChanged() {
        const item = this._item!;
        this._nameInput.value = item.name;
        this._fields = item.fields.map(f => ({ ...f }));
        this._tagsInput.tags = [...item.tags];
    }

    private _removeField(index: number) {
        this._fields = this._fields.filter((_, i) => i !== index);
    }

    private async _deleteItem() {
        this.open = false;
        const confirmed = await confirm($l("Are you sure you want to delete this item?"), $l("Delete"), $l("Cancel"), {
            type: "destructive"
        });
        if (confirmed) {
            app.deleteItems([{ vault: this._vault!, item: this._item! }]);
            router.go("items");
        } else {
            this.open = true;
        }
    }

    private async _addField(field: Field = { name: "", value: "", type: "note" }) {
        this._fields.push(field);
        this.requestUpdate();
        await this.updateComplete;
        setTimeout(() => this._fieldInputs[this._fields.length - 1].focus(), 100);
    }

    private async _move() {
        if (!app.hasWritePermissions(this._vault!)) {
            return;
        }
        this.open = false;
        const movedItems = await this._moveItemsDialog.show([{ item: this._item!, vault: this._vault! }]);
        this.open = true;
        if (movedItems && movedItems.length) {
            router.go(`items/${movedItems[0].id}`);
        }
    }

    private async _editField(index: number) {
        if (!app.hasWritePermissions(this._vault!)) {
            return;
        }
        this._editing = true;
        await this.updateComplete;
        this._fieldInputs[index].focus();
    }

    private async _generateValue(index: number) {
        this.open = false;
        const value = await this._generator.show();
        this.open = true;
        if (value) {
            this._fields[index].value = value;
        }
    }

    private _addAttachment() {
        this._fileInput.click();
    }

    private async _attachFile() {
        // const item = this._item!;
        // const vault = this._vault!;
        // const file = this._fileInput.files![0];
        // if (!file) {
        //     return;
        // }
        //
        // if (file.size > 5e6) {
        //     alert($l("The selected file is too large! Only files of up to 5 MB are supported."), {
        //         type: "warning"
        //     });
        //     return;
        // }
        //
        // const att = await app.createAttachment(vault, file);
        // item.attachments = item.attachments || [];
        // item.attachments.push(att.info);
        // this.requestUpdate();
        // this._fileInput.value = "";
        // const ulp = att.uploadProgress!;
        // const errorHandler: Listener = (e: CustomEvent) => {
        //     const err = e.detail.error;
        //     alert(
        //         err.code === ErrorCode.STORAGE_QUOTA_EXCEEDED
        //             ? $l("You have exceed the storage limit for this vault!")
        //             : $l("Upload failed! Please try again!"),
        //         { type: "warning" }
        //     );
        //     const attachments = this._item!.attachments;
        //     attachments.splice(attachments.findIndex(({ id }) => att.id === id), 1);
        //     this.requestUpdate();
        //     ulp.removeEventListener("error", errorHandler);
        //     app.deleteAttachment(att);
        // };
        // ulp.addEventListener("error", errorHandler);
        // ulp.complete.then(() => setTimeout(() => ulp.removeEventListener("error", errorHandler), 100));
    }

    private async _deleteAttachment(_info: AttachmentInfo) {
        // const confirmed = await confirm(
        //     $l("Are you sure you want to delete '{0}'?", info.name),
        //     $l("Delete"),
        //     $l("Cancel"),
        //     { title: $l("Delete Attachment"), type: "warning" }
        // );
        // if (confirmed) {
        //     await app.deleteAttachment(info);
        //     const attachments = this._item!.attachments;
        //     attachments.splice(attachments.findIndex(({ id }) => info.id === id), 1);
        //     this.requestUpdate();
        // }
    }
}
