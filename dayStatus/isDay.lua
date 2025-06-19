require("json")
local url = "https://api.millenniumapp.io/api/weathers/forecast"

on = "8D0018000000FFFF0000000000000000000000000000"
off = "8D0018000000FFFF0000000000000000FC000000000000"

local function hex_to_binary(hex_string)
    return hex_string:gsub(
        "..",
        function(hex)
            return string.char(tonumber(hex, 16))
        end
    )
end

onMsg = hex_to_binary(on)
offMsg = hex_to_binary(off)

-- Variables globales pour suivre l'état des LED
nordState = false
sudState = false

udpNord = UdpSocket.New()
udpSud = UdpSocket.New()

function setLedNord(msgToSend)
    local isOnMsg = (msgToSend == onMsg)
    if isOnMsg ~= nordState then
        if isOnMsg then
            print("ON MSG SEND TO NORD")
        else
            print("OFF MSG SEND TO NORD")
        end
        nordState = isOnMsg
        udpNord:Open()
        udpNord:Send("10.134.14.53", 9099, msgToSend)
        Timer.CallAfter(
            function()
                udpNord:Close()
            end,
            2
        )
    else
        print("NO CHANGES DETECTED")
    end
end

function setLedSud(msgToSend)
    local isOnMsg = (msgToSend == onMsg)
    if isOnMsg ~= sudState then
        if isOnMsg then
            print("ON MSG SEND TO SUD")
        else
            print("OFF MSG SEND TO SUD")
        end
        sudState = isOnMsg
        udpSud:Open()
        udpSud:Send("10.134.14.54", 9099, msgToSend)
        Timer.CallAfter(
            function()
                udpSud:Close()
            end,
            2
        )
    else
        print("NO CHANGES DETECTED")
    end
end

function convertTime(isoTime)
    local hours, minutes = isoTime:match("T(%d+):(%d+)")
    return string.format("%s:%s", hours, minutes)
end

function updateTimeDisplay(isoTime, controlName)
    if not isoTime then
        return
    end

    local success, formattedTime = pcall(convertTime, isoTime)
    if success then
        Controls[controlName].String = formattedTime
    else
        print(string.format("Error converting time for %s: %s", controlName, formattedTime))
    end
end

function isoToTimestamp(isoTime)
    local year, month, day, hour, minute = isoTime:match("(%d+)-(%d+)-(%d+)T(%d+):(%d+)")
    if year and month and day and hour and minute then
        return os.time(
            {
                year = tonumber(year),
                month = tonumber(month),
                day = tonumber(day),
                hour = tonumber(hour),
                min = tonumber(minute),
                sec = 0
            }
        )
    end
    return nil
end

function updateIsDayStatus()
    local now = os.time()
    sunriseTime = isoToTimestamp(Controls["Sunrise"].String)
    sunsetTime = isoToTimestamp(Controls["Sunset"].String)
    if sunriseTime and sunsetTime then
        Controls["isDay"].Boolean = (now >= sunriseTime and now <= sunsetTime)
        print("Update isDay Boolean = " .. tostring(Controls["isDay"].Boolean))
        if (now >= sunriseTime and now <= sunsetTime) == true then
            setLedNord(onMsg)
            Timer.CallAfter(
                function()
                    setLedSud(onMsg)
                end,
                5
            )
        else
            setLedNord(offMsg)
            Timer.CallAfter(
                function()
                    setLedSud(offMsg)
                end,
                5
            )
        end
    end
    Timer.CallAfter(
        function()
            updateIsDayStatus()
        end,
        60
    )
end

function HandleWeatherResponse(tbl, code, data, err, headers)
    if code == 200 then
        local success, weatherData = pcall(json.decode, data)
        if success and weatherData and #weatherData > 0 then
            local today = weatherData[1]
            if today and today.sunHours then
                sunrise = today.sunHours.sunrise
                sunset = today.sunHours.sunset
                Controls["Sunrise"].String = sunrise
                updateTimeDisplay(sunrise, "sunriseTime")
                Controls["Sunset"].String = sunset
                updateTimeDisplay(sunset, "sunsetTime")
            end
        end
    else
        print(string.format("Error fetching weather data: HTTP code %i, Error: %s", code, err or "None"))
    end
end

function GetWeatherData()
    HttpClient.Download(
        {
            Url = url,
            Headers = {
                ["Content-Type"] = "application/json"
            },
            Timeout = 30,
            EventHandler = HandleWeatherResponse
        }
    )
end

function getTimeUntilNextRun()
    local now = os.time()
    local nextRun =
        os.time(
        {
            year = os.date("*t", now).year,
            month = os.date("*t", now).month,
            day = os.date("*t", now).day,
            hour = 1,
            min = 0,
            sec = 0
        }
    )
    if now > nextRun then
        nextRun = nextRun + 24 * 60 * 60
    end
    print(nextRun - now)
    return nextRun - now
end

function scheduleNextRun()
    local timeUntilNext = getTimeUntilNextRun()
    Timer.CallAfter(
        function()
            GetWeatherData()
            scheduleNextRun()
        end,
        timeUntilNext
    )
end

GetWeatherData()
scheduleNextRun()

Timer.CallAfter(
    function()
        updateIsDayStatus()
    end,
    10
)
