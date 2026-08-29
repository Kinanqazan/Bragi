import React from 'react'
import { SelectInput, useTranslate } from 'react-admin'
import {
  defaultRowsPerPageOptions,
  getStoredPerPage,
  setStoredPerPage,
} from '../common'

export const SelectItemsPerPage = (props) => {
  const translate = useTranslate()
  const current = getStoredPerPage()
  const choices = defaultRowsPerPageOptions.map((value) => ({
    id: value,
    name: String(value),
  }))

  return (
    <SelectInput
      {...props}
      source="itemsPerPage"
      label={translate('menu.personal.options.itemsPerPage', {
        _: 'Items Per Page',
      })}
      defaultValue={current}
      choices={choices}
      translateChoice={false}
      onChange={(event) => {
        setStoredPerPage(Number(event.target.value))
      }}
    />
  )
}
