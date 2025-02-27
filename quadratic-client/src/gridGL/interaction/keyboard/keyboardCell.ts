import { SheetCursor } from '@/grid/sheet/SheetCursor';
import { Rectangle } from 'pixi.js';
import { isEditorOrAbove } from '../../../actions';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { sheets } from '../../../grid/controller/Sheets';
import { pixiAppSettings } from '../../pixiApp/PixiAppSettings';
import { isAllowedFirstChar } from './keyboardCellChars';

function inCodeEditor(editorInteractionState: EditorInteractionState, cursor: SheetCursor): boolean {
  if (!editorInteractionState.showCodeEditor) return false;
  const cursorPosition = cursor.cursorPosition;
  const selectedX = editorInteractionState.selectedCell.x;
  const selectedY = editorInteractionState.selectedCell.y;

  // selectedCell is inside single cursor
  if (selectedX === cursorPosition.x && selectedY === cursorPosition.y) {
    return true;
  }

  // selectedCell is inside multi-cursor
  if (cursor.multiCursor) {
    if (
      selectedX >= cursor.originPosition.x &&
      selectedX <= cursor.terminalPosition.x &&
      selectedY >= cursor.originPosition.y &&
      selectedY <= cursor.terminalPosition.y
    ) {
      return true;
    }
  }
  return false;
}

export function keyboardCell(options: {
  event: React.KeyboardEvent<HTMLElement>;
  editorInteractionState: EditorInteractionState;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
}): boolean {
  const { event, editorInteractionState, setEditorInteractionState } = options;

  const sheet = sheets.sheet;
  const cursor = sheet.cursor;
  const cursorPosition = cursor.cursorPosition;

  const hasPermission = isEditorOrAbove(editorInteractionState.permission);

  if (event.key === 'Tab') {
    // move single cursor one right
    const delta = event.shiftKey ? -1 : 1;
    cursor.changePosition({
      keyboardMovePosition: {
        x: cursorPosition.x + delta,
        y: cursorPosition.y,
      },
      cursorPosition: {
        x: cursorPosition.x + delta,
        y: cursorPosition.y,
      },
    });
    event.preventDefault();
  }

  if (event.key === 'Enter') {
    const x = cursorPosition.x;
    const y = cursorPosition.y;
    const cell = sheet.getRenderCell(x, y);
    if (cell) {
      if (cell.language) {
        const mode = cell.language === 'Python' ? 'PYTHON' : cell.language === 'Formula' ? 'FORMULA' : undefined;
        if (!mode) throw new Error(`Unhandled cell.language ${cell.language} in keyboardCell`);
        // Open code editor, or move code editor if already open.
        setEditorInteractionState({
          ...editorInteractionState,
          showCellTypeMenu: false,
          showCodeEditor: true,
          selectedCell: { x: x, y: y },
          selectedCellSheet: sheets.sheet.id,
          mode,
        });
      } else {
        if (hasPermission) {
          // open single line
          const edit = sheet.getEditCell(x, y);
          pixiAppSettings.changeInput(true, edit);
        }
      }
    } else {
      if (hasPermission) {
        pixiAppSettings.changeInput(true);
      }
    }
    event.preventDefault();
  }

  // Don't allow actions beyond here for certain users
  if (!hasPermission) {
    return false;
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    if (!inCodeEditor(editorInteractionState, cursor)) {
      // delete a range or a single cell, depending on if MultiCursor is active
      sheet.deleteCells(
        new Rectangle(
          cursor.originPosition.x,
          cursor.originPosition.y,
          cursor.terminalPosition.x - cursor.originPosition.x,
          cursor.terminalPosition.y - cursor.originPosition.y
        )
      );
    }
    event.preventDefault();
  }

  if (event.key === '/' || event.key === '=') {
    const x = cursorPosition.x;
    const y = cursorPosition.y;
    const cell = sheet.getRenderCell(x, y);
    if (cell?.language) {
      if (cell.language) {
        const mode = cell.language === 'Python' ? 'PYTHON' : cell.language === 'Formula' ? 'FORMULA' : undefined;
        if (!mode) throw new Error(`Unhandled cell.language ${cell.language} in keyboardCell`);

        if (editorInteractionState.showCodeEditor) {
          // Open code editor, or move change editor if already open.
          setEditorInteractionState({
            ...editorInteractionState,
            showCellTypeMenu: false,
            waitingForEditorClose: {
              selectedCell: { x: x, y: y },
              selectedCellSheet: sheets.sheet.id,
              mode,
              showCellTypeMenu: false,
            },
          });
        } else {
          setEditorInteractionState({
            ...editorInteractionState,
            showCellTypeMenu: false,
            selectedCell: { x: x, y: y },
            selectedCellSheet: sheets.sheet.id,
            mode,
            showCodeEditor: true,
          });
        }
      }
    } else if (editorInteractionState.showCodeEditor) {
      // code editor is already open, so check it for save before closing
      setEditorInteractionState({
        ...editorInteractionState,
        waitingForEditorClose: {
          showCellTypeMenu: true,
          selectedCell: { x: x, y: y },
          selectedCellSheet: sheets.sheet.id,
          mode: 'PYTHON',
        },
      });
    } else {
      // just open the code editor selection menu
      setEditorInteractionState({
        ...editorInteractionState,
        showCellTypeMenu: true,
        selectedCell: { x: x, y: y },
        selectedCellSheet: sheets.sheet.id,
      });
    }
    event.preventDefault();
  }

  if (isAllowedFirstChar(event.key) && !inCodeEditor(editorInteractionState, cursor)) {
    pixiAppSettings.changeInput(true, event.key);
    event.preventDefault();
  }

  return false;
}
