import * as React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { LinkToVersion } from './About'
import TableBody from '@material-ui/core/TableBody'
import TableRow from '@material-ui/core/TableRow'
import Table from '@material-ui/core/Table'
import TableCell from '@material-ui/core/TableCell'

const Wrapper = ({ version }) => (
  <Table>
    <TableBody>
      <TableRow>
        <TableCell>
          <LinkToVersion version={version} />
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
)

describe('<LinkToVersion />', () => {
  afterEach(cleanup)

  it('renders a version as plain text', () => {
    render(<Wrapper version="dev" />)
    expect(screen.getByRole('cell')).toHaveTextContent('dev')
  })

  it('renders an empty initial server version safely', () => {
    render(<Wrapper version="" />)
    expect(screen.getByRole('cell')).toHaveTextContent('—')
  })

  it('renders release and commit details without linking to Navidrome', () => {
    render(<Wrapper version="0.40.0 (300a0292)" />)
    expect(screen.getByRole('cell')).toHaveTextContent('0.40.0 (300a0292)')
    expect(screen.queryByRole('link')).toBeNull()
  })
})
