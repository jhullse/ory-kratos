import { APP_URL, gen, website } from '../../../helpers'
import { authenticator } from 'otplib'

context('MFA Profile', () => {
  describe('Test TOTP', () => {
    before(() => {
      cy.useConfigProfile('mfa')
    })

    let email = gen.email()
    let password = gen.password()

    beforeEach(() => {
      cy.clearCookies()
      email = gen.email()
      password = gen.password()
      cy.registerApi({ email, password, fields: { 'traits.website': website } })
      cy.login({ email, password })
      cy.longPrivilegedSessionTime()
    })

    it('should go through several totp lifecycles', () => {
      cy.visit(APP_URL + '/settings')

      cy.get('p[data-testid="text-totp_secret_key-content"]').should('exist')
      cy.get('img[data-testid="text-totp_qr"]').should('exist')

      // Set up TOTP
      let secret
      cy.get('p[data-testid="text-totp_secret_key-content"]').then(($e) => {
        secret = $e.text().trim()
      })
      cy.get('input[name="totp_code"]').then(($e) => {
        cy.wrap($e).type(authenticator.generate(secret))
      })
      cy.get('*[name="method"][value="totp"]').click()
      cy.get('form .messages .message').should(
        'contain.text',
        'Your changes have been saved!'
      )
      cy.get('p[data-testid="text-totp_secret_key-content"]').should(
        'not.exist'
      )
      cy.get('img[data-testid="text-totp_qr"]').should('not.exist')
      cy.get('*[name="method"][value="totp"]').should('not.exist')
      cy.get('*[name="totp_unlink"]').should('exist')

      // Let's try to do 2FA
      cy.visit(APP_URL + '/auth/login?aal=aal2&refresh=true')
      cy.location().should((loc) => {
        expect(loc.href).to.include('/auth/login')
      })
      cy.get('*[name="method"][value="password"]').should('not.exist')

      // Typing a wrong code leaves us with an error message
      cy.get('*[name="totp_code"]').type('111111')
      cy.get('*[name="method"][value="totp"]').click()

      cy.get('form .messages .message').should(
        'contain.text',
        'The provided authentication code is invalid, please try again.'
      )
      cy.get('input[name="totp_code"]').then(($e) => {
        cy.wrap($e).type(authenticator.generate(secret))
      })
      cy.get('*[name="method"][value="totp"]').click()
      cy.session({
        expectAal: 'aal2',
        expectMethods: ['password', 'totp']
      })

      // Going to settings and unlinking the device
      cy.visit(APP_URL + '/settings')
      cy.get('*[name="totp_unlink"]').click()
      cy.get('form .messages .message').should(
        'contain.text',
        'Your changes have been saved!'
      )
      cy.get('p[data-testid="text-totp_secret_key-content"]').should('exist')
      cy.get('img[data-testid="text-totp_qr"]').should('exist')
      cy.get('*[name="method"][value="totp"]').should('exist')
      cy.get('*[name="totp_unlink"]').should('not.exist')

      // 2FA should be gone
      cy.visit(APP_URL + '/auth/login?aal=aal2&refresh=true')
      cy.location().should((loc) => {
        expect(loc.href).to.include('/auth/login')
      })
      cy.get('*[name="method"][value="totp"]').should('not.exist')

      // Linking a new device works
      cy.visit(APP_URL + '/settings')
      let newSecret
      cy.get('p[data-testid="text-totp_secret_key-content"]').then(($e) => {
        newSecret = $e.text().trim()
      })
      cy.get('input[name="totp_code"]').then(($e) => {
        cy.wrap($e).type(authenticator.generate(newSecret))
      })
      cy.get('*[name="method"][value="totp"]').click()

      // Old secret no longer works in login
      cy.visit(APP_URL + '/auth/login?aal=aal2&refresh=true')
      cy.location().should((loc) => {
        expect(loc.href).to.include('/auth/login')
      })
      cy.get('input[name="totp_code"]').then(($e) => {
        cy.wrap($e).type(authenticator.generate(secret))
      })
      cy.get('*[name="method"][value="totp"]').click()
      cy.get('form .messages .message').should(
        'contain.text',
        'The provided authentication code is invalid, please try again.'
      )

      // But new one does!
      cy.get('input[name="totp_code"]').then(($e) => {
        cy.wrap($e).type(authenticator.generate(newSecret))
      })
      cy.get('*[name="method"][value="totp"]').click()

      cy.session({
        expectAal: 'aal2',
        expectMethods: ['password', 'totp', 'totp']
      })
    })

    it('should not show totp as an option if not configured', () => {
      cy.visit(APP_URL + '/auth/login?aal=aal2')
      cy.location().should((loc) => {
        expect(loc.href).to.include('/auth/login')
      })

      cy.get('*[name="method"][value="totp"]').should('not.exist')
      cy.get('*[name="method"][value="password"]').should('not.exist')
      cy.get('form .messages .message').should(
        'contain.text',
        'Please complete the second authentication challenge.'
      )
    })

    it('should fail to set up totp if verify code is wrong', () => {
      cy.visit(APP_URL + '/settings')
      cy.get('input[name="totp_code"]').type('123456')
      cy.get('*[name="method"][value="totp"]').click()
      cy.get('form .messages .message').should(
        'contain.text',
        'The provided authentication code is invalid, please try again.'
      )
    })
  })
})