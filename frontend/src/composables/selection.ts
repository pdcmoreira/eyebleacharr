import { computed, MaybeRefOrGetter, toValue, Ref } from 'vue'

/**
 * Manage selection of items.
 * Can be used for the entire set of items or for a subset of items.
 * If the passed allItems is a subset of the items to be selected, then the allSelected computed
 * property will be true if all items in the subset are selected.
 * Selecting and deselecting "all items" always refer to the items passed in the allItems parameter.
 */
export function useSelection(
  allItems: MaybeRefOrGetter<Array<number | string>>,
  selectedItems: Ref<Array<number | string>>,
) {
  // Some helpers for quicker lookups.

  const allItemsSet = computed(() => new Set(toValue(allItems)))

  const selectedItemsSet = computed(() => new Set(toValue(selectedItems)))

  /**
   * Dual-binding computed property that returns true if all items are selected and
   * selects/deselects all items when set.
   */
  const allSelected = computed<boolean>({
    get: () =>
      allItemsSet.value.size > 0 &&
      allItemsSet.value.values().every((item) => selectedItemsSet.value.has(item)),

    set: (value: boolean) => {
      if (value) {
        selectAll()
      } else {
        deselectAll()
      }
    },
  })

  /**
   * Check if an item is selected.
   */
  const isSelected = (item: number | string) => selectedItemsSet.value.has(item)

  /**
   * Select an item.
   * If value is false, deselect the item instead.
   */
  const select = (item: number | string, value: boolean = true) => {
    if (!value) {
      deselect(item)

      return
    }

    if (!isSelected(item)) {
      const selected = new Set(selectedItemsSet.value)

      selected.add(item)

      selectedItems.value = Array.from(selected)
    }
  }

  /**
   * Deselect an item.
   */
  const deselect = (item: number | string) => {
    if (isSelected(item)) {
      const selected = new Set(selectedItemsSet.value)

      selected.delete(item)

      selectedItems.value = Array.from(selected)
    }
  }

  /**
   * Select all items (passed in allItems).
   */
  const selectAll = () => {
    const selectedItemsSet = new Set(toValue(selectedItems))

    allItemsSet.value.forEach((item) => {
      selectedItemsSet.add(item)
    })

    selectedItems.value = Array.from(selectedItemsSet)
  }

  /**
   * Deselect all items (passed in allItems).
   */
  const deselectAll = () => {
    const selectedItemsSet = new Set(toValue(selectedItems))

    allItemsSet.value.forEach((item) => {
      selectedItemsSet.delete(item)
    })

    selectedItems.value = Array.from(selectedItemsSet)
  }

  return {
    allSelected,
    isSelected,
    select,
    deselect,
    selectAll,
    deselectAll,
  }
}
