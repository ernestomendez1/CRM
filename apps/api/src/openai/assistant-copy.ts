import type { Locale } from './locale';
import type { AssistantActionType, AssistantSearchResults } from './assistant-types';
import type { BusinessDefaults } from '../domain/business';
import type { CustomerInput } from '@crm/contracts/customer';
import type { ExpenseInput } from '@crm/contracts/expense';
import type { ProductInput } from '@crm/contracts/product';

const assistantCopy = {
  en: {
    unavailable: 'The CRM assistant is not configured yet.',
    quota: 'The CRM assistant is temporarily unavailable because the OpenAI account has no remaining quota or billing is not enabled.',
    providerError: 'The CRM assistant is temporarily unavailable. Please try again in a moment.',
    invalidResponse: 'The CRM assistant returned an unexpected response.',
    unsupported: 'I can help with product, customer, and expense searches, plus creating products, customers, and expenses.',
    clarificationIntro: 'I need a little more information before I can prepare that action.',
    defaults: {
      expenseCurrency(currency: string) {
        return `Currency was not specified, so I used ${currency}.`;
      },
    },
    missingFields(action: AssistantActionType, fields: string[]) {
      const actionLabel =
        action === 'create_product'
          ? 'product'
          : action === 'create_customer'
            ? 'customer'
            : 'expense';
      return `I can prepare that ${actionLabel}, but I still need: ${fields.join(', ')}.`;
    },
    invalidFields(fields: string[]) {
      return `I found a few values that still need fixing: ${fields.join(', ')}.`;
    },
    pendingMessage(action: AssistantActionType) {
      if (action === 'create_product') return 'I prepared a product for review.';
      if (action === 'create_customer') return 'I prepared a customer for review.';
      return 'I prepared an expense for review.';
    },
    searchMessage(results: AssistantSearchResults, query: string) {
      const noun =
        results.entity === 'products'
          ? 'product'
          : results.entity === 'customers'
            ? 'customer'
            : 'expense';
      if (results.items.length === 0) {
        return `I couldn't find any ${noun}s matching "${query}".`;
      }
      return `I found ${results.items.length} ${noun}${results.items.length === 1 ? '' : 's'} matching "${query}".`;
    },
    created(entity: 'products' | 'customers' | 'expenses', label: string) {
      const prefix =
        entity === 'products'
          ? 'Product'
          : entity === 'customers'
            ? 'Customer'
            : 'Expense';
      return `${prefix} created: ${label}.`;
    },
    cancelled: 'Okay, I did not make any changes.',
    summaries: {
      product(payload: ProductInput) {
        const type = payload.type === 'product' ? 'product' : 'service';
        const taxable = payload.is_taxable ? 'taxable' : 'non-taxable';
        return `Create ${type} "${payload.name}" for ${payload.unit_price.toFixed(2)} ${taxable}.`;
      },
      customer(payload: CustomerInput) {
        const company = payload.company_name ? ` for ${payload.company_name}` : '';
        return `Create customer "${payload.name}"${company}.`;
      },
      expense(payload: ExpenseInput) {
        return `Record expense "${payload.vendor_name}" for ${payload.subtotal.toFixed(2)} ${payload.currency} on ${payload.expense_date}.`;
      },
    },
    systemPrompt(defaults: BusinessDefaults) {
      return [
        'You are a helpful CRM assistant for a Dominican Republic business application.',
        'Respond naturally and conversationally, as if the user is chatting with a smart assistant that can also take actions.',
        'Use exactly one function when the user is asking to search or prepare a supported action.',
        'Supported create actions: product, customer, expense.',
        'Supported search actions: products, customers, expenses.',
        'Do not create invoices, quotations, payments, reports, or settings changes.',
        'If the user asks for an unsupported action, answer normally without calling a function.',
        'Use good judgment to fill in all arguments needed for an action.',
        'When the user does not specify a value, propose a reasonable one based on context — for example, a realistic price for the type of product described, or today\'s date for an expense.',
        'When the user explicitly says to choose, use whatever you want, or that it is a test, fill in every remaining field with sensible values and proceed immediately — do not ask for more information.',
        'Only ask the user for a value when you genuinely cannot infer it from the conversation (for example, the name of a customer or vendor when none was mentioned).',
        'Never invent record IDs.',
        'For customer creation, if the message includes a tax ID followed by a person or company name, put the identifier in tax_id and the remaining name text in name.',
        `Business default currency: ${defaults.defaultCurrency}.`,
        `Business default tax rate: ${defaults.defaultTaxRate}.`,
        'When the user writes in Spanish, keep your direct reply in Spanish.',
      ].join(' ');
    },
  },
  es: {
    unavailable: 'El asistente del CRM todavía no está configurado.',
    quota: 'El asistente del CRM no está disponible ahora mismo porque la cuenta de OpenAI no tiene cuota restante o no tiene facturación habilitada.',
    providerError: 'El asistente del CRM no está disponible temporalmente. Inténtelo de nuevo en un momento.',
    invalidResponse: 'El asistente del CRM devolvió una respuesta inesperada.',
    unsupported: 'Puedo ayudar a buscar productos, clientes y gastos, además de preparar la creación de productos, clientes y gastos.',
    clarificationIntro: 'Necesito un poco más de información antes de preparar esa acción.',
    defaults: {
      expenseCurrency(currency: string) {
        return `No se indicó la moneda, así que usé ${currency}.`;
      },
    },
    missingFields(action: AssistantActionType, fields: string[]) {
      const actionLabel =
        action === 'create_product'
          ? 'producto'
          : action === 'create_customer'
            ? 'cliente'
            : 'gasto';
      return `Puedo preparar ese ${actionLabel}, pero todavía necesito: ${fields.join(', ')}.`;
    },
    invalidFields(fields: string[]) {
      return `Encontré algunos valores que todavía hay que corregir: ${fields.join(', ')}.`;
    },
    pendingMessage(action: AssistantActionType) {
      if (action === 'create_product') return 'Preparé un producto para revisión.';
      if (action === 'create_customer') return 'Preparé un cliente para revisión.';
      return 'Preparé un gasto para revisión.';
    },
    searchMessage(results: AssistantSearchResults, query: string) {
      const noun =
        results.entity === 'products'
          ? 'producto'
          : results.entity === 'customers'
            ? 'cliente'
            : 'gasto';
      if (results.items.length === 0) {
        return `No encontré ${noun === 'gasto' ? 'gastos' : `${noun}s`} que coincidan con "${query}".`;
      }
      return `Encontré ${results.items.length} ${noun}${results.items.length === 1 ? '' : 's'} que coinciden con "${query}".`;
    },
    created(entity: 'products' | 'customers' | 'expenses', label: string) {
      const prefix =
        entity === 'products'
          ? 'Producto creado'
          : entity === 'customers'
            ? 'Cliente creado'
            : 'Gasto registrado';
      return `${prefix}: ${label}.`;
    },
    cancelled: 'De acuerdo, no hice ningún cambio.',
    summaries: {
      product(payload: ProductInput) {
        const type = payload.type === 'product' ? 'producto' : 'servicio';
        const taxable = payload.is_taxable ? 'gravado' : 'exento';
        return `Crear ${type} "${payload.name}" por ${payload.unit_price.toFixed(2)} ${taxable}.`;
      },
      customer(payload: CustomerInput) {
        const company = payload.company_name ? ` para ${payload.company_name}` : '';
        return `Crear cliente "${payload.name}"${company}.`;
      },
      expense(payload: ExpenseInput) {
        return `Registrar gasto "${payload.vendor_name}" por ${payload.subtotal.toFixed(2)} ${payload.currency} el ${payload.expense_date}.`;
      },
    },
    systemPrompt(defaults: BusinessDefaults) {
      return [
        'Eres un asistente de CRM amigable para una aplicación de negocio en República Dominicana.',
        'Responde de forma natural y conversacional, como si el usuario estuviera hablando con un asistente inteligente que también puede tomar acciones.',
        'Usa exactamente una función cuando el usuario pida una búsqueda o una acción compatible.',
        'Acciones de creación permitidas: producto, cliente, gasto.',
        'Búsquedas permitidas: productos, clientes, gastos.',
        'No crees facturas, cotizaciones, pagos, reportes ni cambios de configuración.',
        'Si el usuario pide algo no compatible, responde normalmente sin llamar funciones.',
        'Usa buen juicio para completar todos los argumentos necesarios para una acción.',
        'Cuando el usuario no especifique un valor, propón uno razonable según el contexto — por ejemplo, un precio realista para el tipo de producto descrito, o la fecha de hoy para un gasto.',
        'Cuando el usuario diga explícitamente que elijas tú, que uses lo que quieras, o que es una prueba, completa todos los campos restantes con valores sensatos y procede de inmediato — no pidas más información.',
        'Solo pide un valor al usuario cuando genuinamente no puedas inferirlo de la conversación (por ejemplo, el nombre de un cliente o suplidor cuando no se mencionó ninguno).',
        'Nunca inventes IDs de registros.',
        'Para crear clientes, si el mensaje incluye un RNC o cédula seguido por un nombre de persona o empresa, guarda el identificador en tax_id y el nombre restante en name.',
        `Moneda por defecto del negocio: ${defaults.defaultCurrency}.`,
        `Tasa de impuesto por defecto del negocio: ${defaults.defaultTaxRate}.`,
        'Si el usuario escribe en inglés, puedes responder en inglés.',
      ].join(' ');
    },
  },
} as const;

export function getAssistantCopy(locale: Locale) {
  return assistantCopy[locale] ?? assistantCopy.en;
}
