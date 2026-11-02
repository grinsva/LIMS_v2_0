/**
 * Функция вычисления значения свойства "state"
 * 
 *     device - Устройство (Object)
 *     value - входящее значение
 */

module.exports = function(device, prop, value) {
    return value == 0 || value == 1 ? Number(value) : { error: 'Допустимые значения 1/0. Получено ' + value };
  }