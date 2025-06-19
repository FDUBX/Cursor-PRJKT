-- Configuration des paramètres
local baseUrl = "http://10.130.36.155/api/dali"
local interfaces = {4, 5}
local targetAddressesByInterface = {
    [4] = {1, 10, 15, 17, 25, 27, 36},
    [5] = {1, 3, 7, 11, 19, 21, 27}
}

-- Initialisation du composant
local controller = Component.New("faderDaliSpotDemo")

-- Afficher les contrôles disponibles
print("\nContrôles disponibles dans le composant:")
for name, control in pairs(controller) do
    print("Contrôle:", name)
end

-- Fonction pour convertir le niveau DALI (0-254) en valeur de fader (0.0-1.0)
function daliToFader(daliLevel)
    return daliLevel / 254.0
end

-- Fonction pour parser la réponse JSON
function parseJsonResponse(data)
    local json = require("json")
    local success, result = pcall(function() return json.decode(data) end)
    if not success then
        print("Erreur lors du parsing JSON:", result)
        return nil
    end
    return result
end

-- Fonction de gestion des réponses HTTP
function handleResponse(tbl, code, data, err, headers)
    -- Extraire le numéro d'interface de l'URL
    local interface = tonumber(tbl.Url:match("interface=(%d+)"))
    if not interface then return end
    
    print(string.format("Réponse HTTP de '%s': Code=%i; Erreur=%s", tbl.Url, code, err or "Aucune"))
    
    if code == 200 then
        local response = parseJsonResponse(data)
        if response and response.ballast_status then
            print(string.format("\nNiveaux d'éclairage pour l'interface %d:", interface))
            local addresses = targetAddressesByInterface[interface]
            for i, address in ipairs(addresses) do
                for _, ballast in ipairs(response.ballast_status) do
                    if ballast.address == address then
                        -- Calculer l'index du fader (1-7 pour interface 4, 8-14 pour interface 5)
                        local faderIndex = i + (interface == 5 and 7 or 0)
                        local faderValue = daliToFader(ballast.actual_level)
                        
                        -- Mettre à jour le contrôle du fader
                        if controller["dimFaderSpot"] then
                            controller["dimFaderSpot"][faderIndex].Value = faderValue
                        else
                            print("Erreur: Le contrôle dimFaderSpot n'existe pas")
                        end
                        
                        print(string.format("Adresse %d (%s): %d -> Fader %d: %.2f", 
                            address, 
                            ballast.user_name, 
                            ballast.actual_level,
                            faderIndex,
                            faderValue))
                    end
                end
            end
        end
    else
        print("Erreur lors de la requête")
    end
    
    print("Headers:")
    for hName, Val in pairs(headers) do
        if type(Val) == "table" then
            print(string.format("\t%s : ", hName))
            for k, v in pairs(Val) do
                print(string.format("\t\t%s", v))
            end
        else
            print(string.format("\t%s = %s", hName, Val))
        end
    end
end

-- Fonction pour effectuer une requête HTTP
function makeHttpRequest(interface)
    local url = baseUrl .. "?interface=" .. interface
    HttpClient.Download {
        Url = url,
        Headers = {
            ["Content-Type"] = "application/json"
        },
        Timeout = 10, -- 10 secondes de timeout
        EventHandler = handleResponse
    }
end

-- Boucle principale
function main()
    for _, interface in ipairs(interfaces) do
        print("\nInterrogation de l'interface " .. interface)
        makeHttpRequest(interface)
    end
end

-- Exécution du script
main()
