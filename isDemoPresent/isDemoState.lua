function updateDemoState()
  local isAnyEventTrue = false
  local isAnyDemoTrue = false

  -- Vérifier les contrôles Event
  for i = 1, 3 do
    if Controls.Event[i].Boolean then
      isAnyEventTrue = true
      break
    end
  end

  -- Vérifier les contrôles Demo
  for i = 1, 8 do
    if Controls.Demo[i].Boolean then
      isAnyDemoTrue = true
      break
    end
  end

  -- Vérifier varGma
  local isVarGmaTrue = Controls.varGma.Value ~= 0

  -- Mettre à jour isDemoState
  Controls.isDemoState.Boolean = isAnyEventTrue or isAnyDemoTrue or isVarGmaTrue
end

-- Configurer les gestionnaires d'événements
for i = 1, 3 do
  Controls.Event[i].EventHandler = updateDemoState
end

for i = 1, 8 do
  Controls.Demo[i].EventHandler = updateDemoState
end

Controls.varGma.EventHandler = updateDemoState 