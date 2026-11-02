
/**
 * Функция вывода значения "alarm_fire" в виде строки
 * 
 *     device - Устройство (Object)
 *     prop = "alarm_fire"
 *     val - исходное значение
 */
module.exports = function (device, prop, val) {
    return val == 1 ? 'Сработка' : 'Норма';
  }
