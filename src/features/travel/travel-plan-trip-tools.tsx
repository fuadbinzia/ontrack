import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { appPrompt } from "@/components/primitives";
import { useAuthSession } from "@/features/auth/auth-provider";
import {
  isTravelPlanOnCalendar,
  travelCalendarDrafts,
} from "@/features/travel/calendar";
import { TravelExpensesSheet } from "@/features/travel/expenses/travel-expenses-sheet";
import {
  applyStayPackagesToPlan,
  stayPackagesFromPlan,
} from "@/features/travel/stay-package";
import {
  TravelCalendarUpdatedModal,
  type TravelCalendarUpdatedPayload,
} from "@/features/travel/travel-calendar-updated-modal";
import { TravelCurrencySheet } from "@/features/travel/travel-currency-sheet";
import { TravelFriendsSheet } from "@/features/travel/travel-friends-sheet";
import { getOrCreateTravelPackingList } from "@/features/travel/travel-packing-list";
import { TravelTripActionGrid } from "@/features/travel/travel-trip-action-grid";
import { TravelTranslatorSheet } from "@/features/travel/translator/travel-translator-sheet";
import type { TravelPlan } from "@/features/travel/types";
import { TravelWeatherSheet } from "@/features/travel/weather/travel-weather-sheet";
import { useResponsive } from "@/hooks/use-responsive";
import {
  getStraiAwayStatus,
  openStraiAwayStay,
  pullStraiAwayStays,
  pushStraiAwayStays,
} from "@/services/partner/straiaway";
import { usePreferences } from "@/store/preferences";
import { useSchedule } from "@/store/schedule";
import { useTodos } from "@/store/todos";
import { useTravel } from "@/store/travel";
import { useUI } from "@/store/ui";
import { AgentTestId, AgentUiIds } from "@/utils/agent-ui";
import { deferAfterPageTransition } from "@/utils/defer-after-page-transition";

type TravelPlanTripToolsProps = {
  plan: TravelPlan;
  onAddTransport: () => void;
};

/** Trip Tools page content and its locally owned sheets. */
export function TravelPlanTripTools({
  plan,
  onAddTransport,
}: TravelPlanTripToolsProps) {
  const router = useRouter();
  const { user } = useAuthSession();
  const guestName = usePreferences((state) => state.name);
  const { spacing: rs } = useResponsive();
  const savePlan = useTravel((state) => state.savePlan);
  const createTodoList = useTodos((state) => state.createList);
  const recordPlanInteraction = useTravel(
    (state) => state.recordPlanInteraction,
  );
  const activities = useSchedule((state) => state.activities);
  const replaceTravelActivities = useSchedule(
    (state) => state.replaceTravelActivities,
  );
  const dateDisplayFormat = usePreferences((state) => state.dateDisplayFormat);
  const setSelectedDate = useUI((state) => state.setSelectedDate);
  const isOnCalendar = isTravelPlanOnCalendar(activities, plan.id);

  const [weatherVisible, setWeatherVisible] = useState(false);
  const [currencyVisible, setCurrencyVisible] = useState(false);
  const [translatorVisible, setTranslatorVisible] = useState(false);
  const [friendsVisible, setFriendsVisible] = useState(false);
  const [expensesVisible, setExpensesVisible] = useState(false);
  const [calendarUpdated, setCalendarUpdated] =
    useState<TravelCalendarUpdatedPayload | null>(null);

  return (
    <>
      <AgentTestId
        testID={AgentUiIds.travel.planDetail.toolsSection}
        label="Trip Tools compatibility anchor"
      />
      <AgentTestId
        testID={AgentUiIds.travel.tripTools.section(plan.id)}
        label={`Trip Tools for ${plan.title}`}
      >
        <View style={{ gap: rs.md }}>
          <TravelTripActionGrid
            tripId={plan.id}
            tripTitle={plan.title}
            destination={plan.destination}
            mode={plan.mode ?? "flight"}
            isOnCalendar={isOnCalendar}
            showItineraryAction={false}
            onOpenCalendar={() => {
              const nextActivities = replaceTravelActivities(
                plan.id,
                travelCalendarDrafts(plan),
              );
              setCalendarUpdated({
                title: plan.title,
                eventCount: nextActivities.length,
                startDate: plan.startDate,
              });
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
            onSearchFlights={() => {
              router.push({
                pathname: "/travel/[id]/flights",
                params: { id: plan.id },
              } as never);
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
            onAddTransport={() => {
              onAddTransport();
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
            onSearchStays={() => {
              router.push({
                pathname: "/travel/[id]/stays",
                params: { id: plan.id },
              } as never);
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
            onOpenStraiAway={() => {
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
              void (async () => {
                try {
                  const status = await getStraiAwayStatus();
                  if (!status.connected) {
                    router.push("/(tabs)/profile/straiaway" as never);
                    return;
                  }
                  appPrompt.alert(
                    "StraiAway",
                    "Send this trip’s stays, import stays from StraiAway, or open the other app.",
                    [
                      {
                        text: "Send stays",
                        onPress: () => {
                          void pushStraiAwayStays(
                            stayPackagesFromPlan(
                              plan,
                              guestName || user?.email || undefined,
                            ),
                          )
                            .then((result) => {
                              appPrompt.alert(
                                "Sent to StraiAway",
                                `${result.pushed} stay${result.pushed === 1 ? "" : "s"} handed off.`,
                              );
                            })
                            .catch((caught) => {
                              appPrompt.alert(
                                "StraiAway",
                                caught instanceof Error
                                  ? caught.message
                                  : "Stay handoff failed.",
                              );
                            });
                        },
                      },
                      {
                        text: "Import stays",
                        onPress: () => {
                          void pullStraiAwayStays()
                            .then(({ stays }) => {
                              const next = applyStayPackagesToPlan(plan, stays);
                              if (next) savePlan(next);
                              appPrompt.alert(
                                "Imported from StraiAway",
                                stays.length
                                  ? `${stays.length} stay${stays.length === 1 ? "" : "s"} updated.`
                                  : "No stays to import.",
                              );
                            })
                            .catch((caught) => {
                              appPrompt.alert(
                                "StraiAway",
                                caught instanceof Error
                                  ? caught.message
                                  : "Stay import failed.",
                              );
                            });
                        },
                      },
                      {
                        text: "Open StraiAway",
                        onPress: () => {
                          const reservation = plan.itinerary.find(
                            (item) => item.kind === "stay",
                          )?.stay?.straiawayReservationId;
                          void openStraiAwayStay(reservation);
                        },
                      },
                    ],
                  );
                } catch {
                  router.push("/(tabs)/profile/straiaway" as never);
                }
              })();
            }}
            onOpenWeather={() => {
              setWeatherVisible(true);
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
            onOpenCurrency={() => {
              setCurrencyVisible(true);
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
            onOpenTranslator={() => {
              setTranslatorVisible(true);
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
            onOpenExpenses={() => {
              setExpensesVisible(true);
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
            onOpenPackingList={() => {
              const list = getOrCreateTravelPackingList(plan, {
                lists: useTodos.getState().lists,
                createList: createTodoList,
                savePlan,
              });
              if (!list) {
                appPrompt.alert(
                  "Packing List",
                  "The packing list could not be opened. Please try again.",
                );
                return;
              }
              router.push({
                pathname: "/(tabs)/to-do/[id]",
                params: { id: list.id },
              } as never);
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
            onOpenChat={() => {
              router.push({
                pathname: "/travel/[id]/chat",
                params: { id: plan.id },
              } as never);
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
            onOpenCoTravelers={() => {
              setFriendsVisible(true);
              deferAfterPageTransition(() => recordPlanInteraction(plan.id));
            }}
          />
        </View>
      </AgentTestId>

      <TravelWeatherSheet
        plan={plan}
        visible={weatherVisible}
        onClose={() => {
          appPrompt.dismiss();
          setWeatherVisible(false);
        }}
        dateDisplayFormat={dateDisplayFormat}
      />
      <TravelCurrencySheet
        plan={plan}
        visible={currencyVisible}
        onClose={() => {
          appPrompt.dismiss();
          setCurrencyVisible(false);
        }}
      />
      <TravelTranslatorSheet
        plan={plan}
        visible={translatorVisible}
        onClose={() => {
          appPrompt.dismiss();
          setTranslatorVisible(false);
        }}
      />
      <TravelFriendsSheet
        plan={plan}
        visible={friendsVisible}
        onClose={() => {
          appPrompt.dismiss();
          setFriendsVisible(false);
        }}
        onSavePlan={savePlan}
      />
      <TravelExpensesSheet
        plan={plan}
        visible={expensesVisible}
        onClose={() => setExpensesVisible(false)}
        onSavePlan={savePlan}
      />
      <TravelCalendarUpdatedModal
        payload={calendarUpdated}
        onGoToCalendar={(startDate) => {
          setCalendarUpdated(null);
          setSelectedDate(startDate);
          router.navigate("/(tabs)/calendar");
        }}
        onBackToTravel={() => setCalendarUpdated(null)}
      />
    </>
  );
}
