
/**
 * Функция вывода значения "state" в виде строки
 * 
 *     device - Устройство (Object)
 *     prop = "state"
 *     val - исходное значение
 */
module.exports = function (device, prop, val) {
    if (val == 0) return "Не определено";
    if (val == 1) return "Старт";
    if (val == 2) return "Стоп";
    if (val == 3) return "Автоматический режим";    
  }
